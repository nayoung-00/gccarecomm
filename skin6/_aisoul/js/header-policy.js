(function () {
    'use strict';
  
    var TOKEN_PARAM = 'gcUiContextToken';
    var ENTRY_KEY = 'gcCommerceEntryPath';
  
    /**
     * Token을 제외한 pathname + search.
     * query key는 정렬하고, 동일 key의 값 순서는 유지한다.
     * hash는 비교에서 제외.
     *
     * TODO: 상품 SEO URL (/product/.../{no}/category/...) 과
     * /product/detail.html?product_no= 는 서로 다른 문자열로 비교된다.
     * 확실한 정규화 규칙이 정해지기 전까지 변환하지 않는다.
     */
    function toComparablePath(href) {
      var url = new URL(href, window.location.origin);
      var params = new URLSearchParams(url.search);
  
      params.delete(TOKEN_PARAM);
  
      var keys = [];
      params.forEach(function (_value, key) {
        if (keys.indexOf(key) === -1) {
          keys.push(key);
        }
      });
      keys.sort();
  
      var normalized = new URLSearchParams();
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var values = params.getAll(key);
        for (var j = 0; j < values.length; j++) {
          normalized.append(key, values[j]);
        }
      }
  
      var search = normalized.toString();
      return url.pathname + (search ? '?' + search : '');
    }
  
    function syncEntryPathFromUrl() {
      var url;
  
      try {
        url = new URL(window.location.href);
      } catch (e) {
        return;
      }
  
      var token = url.searchParams.get(TOKEN_PARAM) || '';
      if (!token) return;
  
      try {
        sessionStorage.setItem(ENTRY_KEY, toComparablePath(url.href));
      } catch (storageError) {
        // sessionStorage 사용 불가 시 URL 정리도 하지 않음
        return;
      }
  
      // entry 저장 후, navigation/reload 없이 Token만 URL에서 제거
      url.searchParams.delete(TOKEN_PARAM);
  
      var cleanUrl =
        url.pathname +
        (url.search ? url.search : '') +
        (url.hash ? url.hash : '');
  
      try {
        history.replaceState(history.state, '', cleanUrl);
      } catch (historyError) {
        // replaceState 실패 시에도 entry는 이미 저장된 상태 유지
      }
    }
  
    function getEntryPath() {
      try {
        return sessionStorage.getItem(ENTRY_KEY) || '';
      } catch (storageError) {
        return '';
      }
    }
  
    function isBackOnlyPage() {
      return !!document.querySelector('[data-gc-header-policy="back-only"]');
    }
  
    function setDisplayNone(el, hidden) {
      if (!el) return;
      if (hidden) {
        el.classList.add('displaynone');
      } else {
        el.classList.remove('displaynone');
      }
    }
  
    function applyHeaderType(headerType) {
      if (headerType !== 'MENU' && headerType !== 'BACK') return;
  
      document.querySelectorAll('.sub-header, .main-header').forEach(function (header) {
        var menuBtn = header.querySelector('.menu-btn');
        var backWrap = header.querySelector('.back-wrap');
  
        if (headerType === 'MENU') {
          setDisplayNone(menuBtn, false);
          setDisplayNone(backWrap, true);
        } else {
          setDisplayNone(menuBtn, true);
          setDisplayNone(backWrap, false);
        }
      });
    }

   /**
   * Header MENU/BACK 비교 전용.
   * /product/list.html 끼리는 cate_no 차이를 무시한다.
   * /board/free/list.html + board_no=3 끼리는 category_no 차이를 무시한다.
   */
  function isSameCommerceEntry(entryPath, currentPath) {
    if (!entryPath || !currentPath) return false;
    if (entryPath === currentPath) return true;

    try {
      var entryUrl = new URL(entryPath, window.location.origin);
      var currentUrl = new URL(currentPath, window.location.origin);

      if (
        entryUrl.pathname === '/product/list.html' &&
        currentUrl.pathname === '/product/list.html'
      ) {
        entryUrl.searchParams.delete('cate_no');
        currentUrl.searchParams.delete('cate_no');
      } else if (
        entryUrl.pathname === '/board/free/list.html' &&
        currentUrl.pathname === '/board/free/list.html' &&
        entryUrl.searchParams.get('board_no') === '3' &&
        currentUrl.searchParams.get('board_no') === '3'
      ) {
        entryUrl.searchParams.delete('category_no');
        currentUrl.searchParams.delete('category_no');
      } else {
        return false;
      }

      return (
        toComparablePath(entryUrl.pathname + entryUrl.search) ===
        toComparablePath(currentUrl.pathname + currentUrl.search)
      );
    } catch (e) {
      return false;
    }
  }
  
    function resolveAndApplyHeader() {
      // 1~3. Token 있으면 entry 저장 후 URL에서 Token 제거
      syncEntryPathFromUrl();
  
      // 4~5. B 타입: 기존 BACK-only HTML/CSS 유지
      if (isBackOnlyPage()) return;
  
      // 6~7. entry 없으면 SSR 기본 헤더 유지
      var entryPath = getEntryPath();
      if (!entryPath) return;
  
      // 8~10. A 타입 MENU/BACK 판정
      var currentPath = toComparablePath(window.location.href);
      applyHeaderType(
        isSameCommerceEntry(entryPath, currentPath) ? 'MENU' : 'BACK'
      );
    }


    // 사이드바 메뉴/뒤로가기 판정

    var SIDEBAR_ENTRY_PATHS = [
      '/product/promotion_list.html',
      '/product/list.html?cate_no=50',
      '/product/list.html?cate_no=51',
      '/myshop/index.html',
      '/member/login.html',
      '/board/consult/list.html',
      '/board/free/list.html?board_no=3',
      '/board/free/list.html?board_no=1'
    ].map(function (href) {
      return toComparablePath(href);
    });
  
    function isSidebarEntryLink(link) {
      if (!link || !link.href) return false;
      if (!link.closest || !link.closest('#aside')) return false;
  
      var destination;
  
      try {
        destination = toComparablePath(link.href);
      } catch (e) {
        return false;
      }
  
      return SIDEBAR_ENTRY_PATHS.indexOf(destination) !== -1;
    }

    // Store Home 링크 판별
    function isSubHeaderStoreHomeEntryLink(link) {
      if (!link || !link.href) return false;
      if (
        !link.matches ||
        !link.matches('.sub-header .title a, .main-header .logo a')
      ) {
        return false;
      }
  
      try {
        return toComparablePath(link.href) === '/';
      } catch (e) {
        return false;
      }
    }
  
    function handleSidebarEntryClick(event) {
      var link =
        event.target &&
        event.target.closest &&
        event.target.closest('a[href]');
  
        if (!isSidebarEntryLink(link) && !isSubHeaderStoreHomeEntryLink(link)) return;
  
      var currentEntry = getEntryPath();
      if (!currentEntry) return;
  
      try {
        sessionStorage.setItem(ENTRY_KEY, toComparablePath(link.href));
      } catch (storageError) {
        // sessionStorage 사용 불가 시 navigation은 그대로 진행
      }
    }
  
    function bindSidebarEntryUpdate() {
      if (window.__gcSidebarEntryUpdateBound) return;
      window.__gcSidebarEntryUpdateBound = true;
  
      document.addEventListener('click', handleSidebarEntryClick, true);
    }

    // 사이드바 메뉴/뒤로가기 판정 종료
  
    function initHeaderPolicy() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', resolveAndApplyHeader);
      } else {
        resolveAndApplyHeader();
      }
  
      window.addEventListener('pageshow', function (event) {
        if (event.persisted) {
          resolveAndApplyHeader();
        }
      });
    }
  
    initHeaderPolicy();
    bindSidebarEntryUpdate();
  })();
  