(function () {
    'use strict';
  
    var TOKEN_PARAM = 'gcUiContextToken';
    var ENTRY_KEY = 'gcCommerceEntryPath';
    var HEADER_ENTRY_STATE_KEY = 'gcHeaderEntry';
    var PENDING_KEY = 'gcHeaderEntryPending';
    var MARKER_MODE_KEY = 'gcHeaderMarkerActive';
  
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

    function getHistoryStateObject() {
      var state = history.state;
      if (state && typeof state === 'object') {
        return Object.assign({}, state);
      }
      return {};
    }

    function setMarkerModeActive() {
      try {
        sessionStorage.setItem(MARKER_MODE_KEY, '1');
      } catch (storageError) {
        // ignore
      }
    }

    function isMarkerModeActive() {
      try {
        return sessionStorage.getItem(MARKER_MODE_KEY) === '1';
      } catch (storageError) {
        return false;
      }
    }

    function isHistoryHeaderEntry() {
      var state = history.state;
      return !!(
        state &&
        typeof state === 'object' &&
        state[HEADER_ENTRY_STATE_KEY] === true
      );
    }

    /**
     * 현재 History entry에 MENU marker만 병합한다.
     * 기존 history.state는 보존한다. replaceState(null, ...) 사용 금지.
     */
    function markCurrentHistoryEntry(url) {
      var nextState = getHistoryStateObject();
      nextState[HEADER_ENTRY_STATE_KEY] = true;

      try {
        history.replaceState(
          nextState,
          '',
          url || window.location.href
        );
        setMarkerModeActive();
      } catch (historyError) {
        // replaceState 실패 시에도 이후 판정은 기존 로직에 맡김
      }
    }

    function setPendingHeaderEntry(path) {
      try {
        sessionStorage.setItem(
          PENDING_KEY,
          JSON.stringify({ path: path })
        );
      } catch (storageError) {
        // ignore
      }
    }

    function getPendingHeaderEntry() {
      try {
        var raw = sessionStorage.getItem(PENDING_KEY);
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        if (!parsed || typeof parsed.path !== 'string') return null;
        return parsed;
      } catch (e) {
        return null;
      }
    }

    function clearPendingHeaderEntry() {
      try {
        sessionStorage.removeItem(PENDING_KEY);
      } catch (storageError) {
        // ignore
      }
    }

    /**
     * 목적지 문서에서 pending을 1회만 소비한다.
     * path가 일치할 때만 현재 History entry에 marker를 남긴다.
     */
    function consumePendingHeaderEntry(currentPath) {
      var pending = getPendingHeaderEntry();
      if (!pending) return;

      // 영구 잔류 방지: 문서당 1회 시도 후 항상 제거
      clearPendingHeaderEntry();

      if (pending.path === currentPath) {
        markCurrentHistoryEntry();
      }
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
  
      // Token 제거 + MENU marker를 한 번의 replaceState로 적용
      markCurrentHistoryEntry(cleanUrl);
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
   *
   * 레거시 fallback 전용. History marker 모드가 켜진 뒤에는
   * 동일 URL 재방문이 잘못 MENU가 되지 않도록 사용하지 않는다.
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
      // 1. Token 있으면 레거시 entry 저장 + History MENU marker + URL에서 Token 제거
      syncEntryPathFromUrl();

      var currentPath = toComparablePath(window.location.href);

      // 2. 사이드바/스토어홈 클릭으로 넘어온 목적지라면 현재 entry에 marker
      consumePendingHeaderEntry(currentPath);
  
      // 3. B 타입: 기존 BACK-only HTML/CSS 유지
      if (isBackOnlyPage()) return;

      // 4. History entry marker 우선
      if (isHistoryHeaderEntry()) {
        applyHeaderType('MENU');
        return;
      }

      // 5. 스토어 홈은 Navigation Group / marker와 무관하게 MENU
      if (currentPath === '/') {
        applyHeaderType('MENU');
        return;
      }
  
      // 6. 레거시: entry 없으면 SSR 기본 헤더 유지
      var entryPath = getEntryPath();
      if (!entryPath) return;

      // 7. History marker 모드가 켜진 뒤에는 path 비교로 MENU를 주지 않는다.
      //    (동일 URL 새 History entry가 gcCommerceEntryPath 때문에 MENU 되는 것 방지)
      if (isMarkerModeActive()) {
        applyHeaderType('BACK');
        return;
      }
  
      // 8. 레거시 fallback: marker 도입 전 세션만 path 비교
      applyHeaderType(
        isSameCommerceEntry(entryPath, currentPath) ? 'MENU' : 'BACK'
      );
    }


    // 사이드바 메뉴/뒤로가기 판정
    // 카테고리 번호는 클릭 시점에 hostname으로 선택한다.
    // 미등록 호스트는 카테고리 경로를 만들지 않는다.

    var SIDEBAR_FIXED_ENTRY_PATHS = [
      '/product/promotion_list.html',
      '/myshop/index.html',
      '/member/login.html',
      '/board/consult/list.html',
      '/board/free/list.html?board_no=3',
      '/board/free/list.html?board_no=1'
    ];

    function getHeaderEntryCategoryNos() {
      var host = location.hostname;
      if (host === 'gccarecomm.cafe24.com') return ['50', '51'];
      if (host === 'gccarecommstg.cafe24.com') return ['42', '43'];
      return [];
    }

    function getSidebarEntryPaths() {
      var hrefs = SIDEBAR_FIXED_ENTRY_PATHS.slice();
      var nos = getHeaderEntryCategoryNos();
      for (var i = 0; i < nos.length; i++) {
        hrefs.push('/product/list.html?cate_no=' + nos[i]);
      }
      return hrefs.map(function (href) {
        return toComparablePath(href);
      });
    }

    function isSameOriginHref(href) {
      try {
        return new URL(href, window.location.origin).origin === window.location.origin;
      } catch (e) {
        return false;
      }
    }
  
    function isSidebarEntryLink(link) {
      if (!link || !link.href) return false;
      if (!link.closest || !link.closest('#aside')) return false;
      if (!isSameOriginHref(link.href)) return false;
  
      var destination;
  
      try {
        destination = toComparablePath(link.href);
      } catch (e) {
        return false;
      }
  
      return getSidebarEntryPaths().indexOf(destination) !== -1;
    }

    // Store Home 링크 판별
    function isSubHeaderStoreHomeEntryLink(link) {
      if (!link || !link.href) return false;
      if (!isSameOriginHref(link.href)) return false;
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

      var destinationPath;
      try {
        destinationPath = toComparablePath(link.href);
      } catch (e) {
        return;
      }

      // 목적지는 아직 History entry가 없으므로 pending으로만 표시
      setPendingHeaderEntry(destinationPath);
  
      try {
        // 레거시 호환: 기존 Navigation Group pointer도 갱신
        sessionStorage.setItem(ENTRY_KEY, destinationPath);
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
