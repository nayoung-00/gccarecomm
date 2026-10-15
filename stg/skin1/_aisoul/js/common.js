(function () {
    'use strict';

    var JQUERY_WAIT_INTERVAL = 50;
    var JQUERY_WAIT_MAX_TRY = 100;
    var SCROLL_THRESHOLD = 5;
    var TOP_OFFSET = 10;

    waitForJQuery(init);

    function waitForJQuery(callback, tryCount) {
        var currentTry = tryCount || 0;

        if (window.jQuery) {
            callback(window.jQuery);
            return;
        }

        if (currentTry >= JQUERY_WAIT_MAX_TRY) {
            console.error('[COMMON] jQuery 로드 타임아웃 - 공통 스크립트 비활성화');
            return;
        }

        window.setTimeout(function () {
            waitForJQuery(callback, currentTry + 1);
        }, JQUERY_WAIT_INTERVAL);
    }

    function init($) {
        $(function () {
            initSidebar($);
            initHeaderScroll();
            initFooterAccordion($);
            initFixedButton($);
            initBasketOptionModal($);
            initBasketCountLabel($);
            initCommerceClose($);
        });
    }

    
  /* =====================================================
     1:1 문의 목록 진입 직전 URL 저장 (CF History 우회용)
  ===================================================== */
  var GC_CONSULT_LIST_RETURN_URL_KEY = 'gcConsultListReturnUrl';

  initConsultListReturnUrlCapture();

  function isConsultListOrWritePath(pathname) {
      return /\/board\/consult\/(list|write)\.html$/i.test(pathname || '');
  }

  function toSameOriginPath(href) {
      try {
          var url = new URL(href, window.location.origin);
          if (url.origin !== window.location.origin) {
              return '';
          }
          return url.pathname + url.search + url.hash;
      } catch (e) {
          return '';
      }
  }

  function initConsultListReturnUrlCapture() {
      if (window.__gcConsultListReturnUrlCaptureBound) {
          return;
      }
      window.__gcConsultListReturnUrlCaptureBound = true;

      document.addEventListener(
          'click',
          function (event) {
              var link =
                  event.target.closest &&
                  event.target.closest('a[href*="/board/consult/list.html"]');

              if (!link) return;

              // 문의 list/write 안에서의 이동은 returnUrl로 쓰지 않음
              if (isConsultListOrWritePath(window.location.pathname)) {
                  return;
              }

              var currentPath = toSameOriginPath(window.location.href);
              if (!currentPath) return;

              try {
                  sessionStorage.setItem(
                      GC_CONSULT_LIST_RETURN_URL_KEY,
                      currentPath
                  );
              } catch (e) {}
          },
          true
      );
  }


    // 배너매니저 공통 
    $('.df-bannermanager').each(function () {
        var $wrap = $(this);
        
        // 컬러 변경 
        // white -> #fff
        // black -> #000
        $wrap.find('img[alt]').each(function () {
            var $img = $(this);
            var alt = $.trim($img.attr('alt')).toLowerCase();
            var color = (alt === 'white') ? '#fff' : '#000';
            var $item = $img.closest('.df-bannermanager > *');
            if (!$item.length) { $item = $img.parent(); }
            $item.css('color', color);
        });
    });

    /* =====================================================
       커머스 헤더 X 버튼 → Android/iOS Native Bridge
    ===================================================== */
    function initCommerceClose($) {
        $(document).off('click.commerceClose', '.main-close').on('click.commerceClose', '.main-close', function (event) {
            event.preventDefault();

            try {
                if (window.android && typeof window.android.webToAppCommerceClose === 'function') {
                    window.android.webToAppCommerceClose(JSON.stringify({}));
                    return;
                }

                var iosCommerceCloseHandler =
                    window.webkit &&
                    window.webkit.messageHandlers &&
                    window.webkit.messageHandlers.webToAppCommerceClose;

                if (
                    iosCommerceCloseHandler &&
                    typeof iosCommerceCloseHandler.postMessage === 'function'
                ) {
                    iosCommerceCloseHandler.postMessage({});
                    return;
                }

            } catch (error) {
                console.error('[COMMON][COMMERCE_CLOSE]', error);
            }
        });
    }

    /* =====================================================
       사이드 메뉴
    ===================================================== */
    function initSidebar($) {
        var $menu = $('.menu-btn');
        var $sidebar = $('.sidebar-panel');
        var $dim = $('.sidebar-dim');
        var $close = $('.btnClose');

        if ($sidebar.length === 0) return;

        requestAnimationFrame(function () {
            $sidebar.addClass('is-transitionable');
        });

        function openSidebar() {
            $sidebar.addClass('is-open').attr('aria-hidden', 'false');
            $dim.addClass('is-open');

            $menu.attr('aria-expanded', 'true');
            $('html, body').addClass('sidebar-open');
        }

        function closeSidebar() {
            if ($sidebar.get(0).contains(document.activeElement)) {
                $menu.trigger('focus');
            }

            $sidebar.removeClass('is-open').attr('aria-hidden', 'true');
            $dim.removeClass('is-open');

            $menu.attr('aria-expanded', 'false');
            $('html, body').removeClass('sidebar-open');
        }

        $menu.on('click', openSidebar);
        $close.on('click', closeSidebar);
        $dim.on('click', closeSidebar);

        $(document).on('keydown.sidebar', function (event) {
            if (event.key === 'Escape' && $sidebar.hasClass('is-open')) {
                closeSidebar();
            }
        });
    }

    /* =====================================================
       헤더 스크롤 hide/show
    ===================================================== */
    function initHeaderScroll() {
        var headerCandidates = document.querySelectorAll('.header');
        var header = null;

        for (var i = 0; i < headerCandidates.length; i++) {
            if (headerCandidates[i].offsetParent !== null) {
                header = headerCandidates[i];
                break;
            }
        }

        if (!header) {
            //   console.warn('[HEADER_SCROLL] 화면에 보이는 .header를 못 찾음');
            return;
        }

        // console.log('[HEADER_SCROLL] 초기화 완료, 대상:', header.className);

        var lastScrollY = window.scrollY;
        var ticking = false;

        function handleScroll() {
            var currentScrollY = window.scrollY;
            var delta = currentScrollY - lastScrollY;

            if (currentScrollY <= TOP_OFFSET) {
                header.classList.remove('is-hidden');
            } else if (Math.abs(delta) > SCROLL_THRESHOLD) {
                if (delta > 0) {
                    header.classList.add('is-hidden');
                } else {
                    header.classList.remove('is-hidden');
                }
            }

            lastScrollY = currentScrollY;
            ticking = false;
        }

        window.addEventListener('scroll', function () {
            if (!ticking) {
                window.requestAnimationFrame(handleScroll);
                ticking = true;
            }
        }, { passive: true });
    }


    /* =====================================================
      장바구니 개수 "개" 단위 제거 + 중복 id 동기화 + 0개일 때 숨김
    ===================================================== */

    function initBasketCountLabel($) {
        var $basketCounts = $('[id="xans_myshop_basket_cnt"]');
        if (!$basketCounts.length) return;

        var $source = $basketCounts.first();

        function syncAndStripUnit() {
            var text = $source.text().replace(/개\s*$/, '');
            var count = parseInt(text, 10);
            var isZero = !isNaN(count) && count === 0;

            $basketCounts.each(function () {
                var $count = $(this);

                if ($count.text() !== text) {
                    $count.text(text);
                }

                $count.closest('strong').toggleClass('is-zero', isZero);
            });
        }

        syncAndStripUnit();

        var observer = new MutationObserver(syncAndStripUnit);
        observer.observe($source.get(0), {
            childList: true,
            characterData: true,
            subtree: true
        });
    }



    /* =====================================================
       footer 아코디언
    ===================================================== */
    function initFooterAccordion($) {
        $('.bt-info-title').on('click', function () {
            var $title = $(this);
            var $info = $title.next('.bt_info');

            $title.toggleClass('is-open');
            $info.stop(true, true).slideToggle(250);
        });
    }

    /* =====================================================
       바텀 고정 버튼 (className: fixed-btn-comm)
    ===================================================== */
    function initFixedButton($) {
        /* 복제본을 제외한 실제 원본만 선택 */
        var $original = $('.fixed-btn-comm')
            .not('.fixed-btn-comm--visual')
            .first();

        if (!$original.length) {
            //   console.log('[FIXED BUTTON] 원본을 찾지 못함');
            return;
        }

        /* 중복 생성 방지 */
        if ($('.fixed-btn-comm--visual').length) {
            return;
        }

        $original.css({
            position: 'absolute',
            opacity: 0,
            pointerEvents: 'none',
            height: 0,
            padding: 0,
            overflow: 'hidden'
        });

        var $visual = $original.clone(false);

        $visual
            .removeAttr('style')
            .addClass('fixed-btn-comm--visual');

        var $realControls = $original.find('a, button');
        var $visualControls = $visual.find('a, button');

        /* 복제본의 기존 onclick 제거 */
        $visualControls.removeAttr('onclick');

        $visualControls.each(function (index) {
            $(this).on('click', function (event) {
                event.preventDefault();

                var realControl = $realControls.get(index);

                if (realControl) {
                    realControl.click();
                }
            });
        });

        $visual.appendTo('body');
        setFixedButtonFooterPadding($visual, $);
    }

    function setFixedButtonFooterPadding($fixedBtn, $) {
        var $footer = $('#footer');

        if (!$footer.length) return;

        var originalPaddingBottom =
            parseFloat($footer.css('padding-bottom')) || 0;

        function update() {
            var fixedBtnHeight = 0;

            if ($fixedBtn.is(':visible')) {
                fixedBtnHeight = $fixedBtn.outerHeight(true) || 0;
            }

            $footer.css(
                'padding-bottom',
                originalPaddingBottom + fixedBtnHeight + 'px'
            );
        }

        update();

        $(window).on('resize.fixedBtn', update);
        if (window.ResizeObserver) {
            var observer = new ResizeObserver(update);
            observer.observe($fixedBtn.get(0));
        }
    }

    /* =====================================================
       상품 옵션 변경 모달
    ===================================================== */
    function initBasketOptionModal($) {
        var $layer = $('#ec-basketOptionModifyLayer');

        if (!$layer.length) return;

        $layer.appendTo('body');

        function updateModalState() {
            var inlineDisplay = $layer.get(0).style.display;
            var isVisible = inlineDisplay !== 'none';

            if (isVisible) {
                $layer.addClass('is-open');
                $('html, body').addClass('option-modal-open');
            } else {
                $layer.removeClass('is-open');
                $('html, body').removeClass('option-modal-open');
            }
        }

        var observer = new MutationObserver(updateModalState);

        observer.observe($layer.get(0), {
            attributes: true,
            attributeFilter: ['style']
        });

        /* 닫기 버튼 */
        $(document).on(
            'click.basketOptionModal',
            '#ec-basketOptionModifyLayer .btnClose',
            function (event) {
                event.preventDefault();

                $layer.removeClass('is-open');
                $layer.css('display', 'none');
                $('html, body').removeClass('option-modal-open');
            }
        );

        updateModalState();
    }
})();
