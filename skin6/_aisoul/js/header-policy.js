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
      applyHeaderType(entryPath === currentPath ? 'MENU' : 'BACK');
    }
  
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
  })();
  