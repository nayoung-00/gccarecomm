(function () {
    'use strict';

    const BOARD_NO_NOTICE = 1;
    const BOARD_NO_FAQ = 3;
    const JQUERY_WAIT_INTERVAL = 50;
    const JQUERY_WAIT_MAX_TRY = 100;
    const DRAG_THRESHOLD = 5;
    const WRITE_PAGE_PATH_PATTERN = /\/(write|modify|reply)\.html/;
    const CONSULT_WRITE_PATH_PATTERN = /\/board\/consult\/write\.html$/i;
    const CONSULT_LIST_PATH_PATTERN = /\/board\/consult\/list\.html$/i;
    const GC_CONSULT_LIST_RETURN_URL_KEY = 'gcConsultListReturnUrl';
    const GC_CONSULT_SKIP_HIST_BACK_KEY = 'gcConsultSkipHistBack';
    const CONSULT_FALLBACK_RETURN = '/';
    let dragEventId = 0;

    // jQuery 대기와 무관하게 consult list/write back 상태 관리
    initConsultNavigation();

    waitForJQuery(init);

    function waitForJQuery(callback, tryCount) {
        const currentTry = tryCount || 0;

        if (window.jQuery) {
            callback(window.jQuery);
            return;
        }

        if (currentTry >= JQUERY_WAIT_MAX_TRY) {
            console.error('[BOARD] jQuery 로드 타임아웃 - 게시판 기능 비활성화');
            return;
        }

        window.setTimeout(function () {
            waitForJQuery(callback, currentTry + 1);
        }, JQUERY_WAIT_INTERVAL);
    }

    function init($) {
        $(function () {
            initBoardType($);

            if (!isWritePage()) {
                initBoardCategoryTabs($);
            }

            initConsultTabs($);
            initPaging();
            // initFixedWriteBtn($);
        });
    }

    function isWritePage() {
        return WRITE_PAGE_PATH_PATTERN.test(window.location.pathname);
    }

    
    /* =====================================================
       1:1 문의 list/write — CF History 우회 navigation state
    ===================================================== */
    function initConsultNavigation() {
        initConsultWriteBack();
        initConsultListBack();
        initConsultListReturnUrlFallback();
    }

    function getSessionItem(key) {
        try {
            return sessionStorage.getItem(key);
        } catch (e) {
            return null;
        }
    }

    function setSessionItem(key, value) {
        try {
            sessionStorage.setItem(key, value);
        } catch (e) {}
    }

    function removeSessionItem(key) {
        try {
            sessionStorage.removeItem(key);
        } catch (e) {}
    }

    function toSameOriginPath(href) {
        try {
            const url = new URL(href, window.location.origin);
            if (url.origin !== window.location.origin) {
                return '';
            }
            return url.pathname + url.search + url.hash;
        } catch (e) {
            return '';
        }
    }

    function isConsultListOrWritePath(pathname) {
        return /\/board\/consult\/(list|write)\.html$/i.test(pathname || '');
    }

    function isCloudflareRelatedUrl(href) {
        try {
            const url = new URL(href, window.location.origin);
            const host = url.hostname.toLowerCase();
            const path = url.pathname.toLowerCase();

            if (host.indexOf('cloudflare') !== -1) return true;
            if (path.indexOf('/cdn-cgi/') !== -1) return true;
            if (path.indexOf('challenge') !== -1) return true;
            return false;
        } catch (e) {
            return true;
        }
    }

    function getSafeConsultReturnUrl() {
        const stored = getSessionItem(GC_CONSULT_LIST_RETURN_URL_KEY);
        if (!stored) return CONSULT_FALLBACK_RETURN;

        const path = toSameOriginPath(stored);
        if (!path) return CONSULT_FALLBACK_RETURN;
        if (isConsultListOrWritePath(path.split('?')[0])) {
            return CONSULT_FALLBACK_RETURN;
        }
        if (isCloudflareRelatedUrl(path)) {
            return CONSULT_FALLBACK_RETURN;
        }

        return path;
    }

    function stopBackEvent(event) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') {
            event.stopImmediatePropagation();
        }
    }

    function initConsultWriteBack() {
        if (!CONSULT_WRITE_PATH_PATTERN.test(window.location.pathname)) {
            return;
        }

        if (window.__gcConsultWriteBackBound) {
            return;
        }
        window.__gcConsultWriteBackBound = true;

        document.addEventListener(
            'click',
            function (event) {
                const back =
                    event.target.closest &&
                    event.target.closest('.back-btn');

                if (!back) return;

                stopBackEvent(event);

                setSessionItem(GC_CONSULT_SKIP_HIST_BACK_KEY, '1');

                let boardNo = '9';
                try {
                    boardNo =
                        new URLSearchParams(window.location.search).get(
                            'board_no'
                        ) || '9';
                } catch (e) {}

                window.location.replace(
                    '/board/consult/list.html?board_no=' +
                        encodeURIComponent(boardNo)
                );
            },
            true
        );
    }

    function initConsultListBack() {
        if (!CONSULT_LIST_PATH_PATTERN.test(window.location.pathname)) {
            return;
        }

        if (getSessionItem(GC_CONSULT_SKIP_HIST_BACK_KEY) !== '1') {
            return;
        }

        if (window.__gcConsultListBackBound) {
            return;
        }
        window.__gcConsultListBackBound = true;

        document.addEventListener(
            'click',
            function (event) {
                const back =
                    event.target.closest &&
                    event.target.closest('.back-btn');

                if (!back) return;

                // 플래그가 이미 소비된 경우 기본 back 유지
                if (getSessionItem(GC_CONSULT_SKIP_HIST_BACK_KEY) !== '1') {
                    return;
                }

                stopBackEvent(event);

                const returnUrl = getSafeConsultReturnUrl();

                removeSessionItem(GC_CONSULT_SKIP_HIST_BACK_KEY);
                removeSessionItem(GC_CONSULT_LIST_RETURN_URL_KEY);

                window.location.replace(returnUrl);
            },
            true
        );
    }

    function initConsultListReturnUrlFallback() {
        if (!CONSULT_LIST_PATH_PATTERN.test(window.location.pathname)) {
            return;
        }

        // write → replace(list) 복귀 시 returnUrl/referrer 덮어쓰기 금지
        if (getSessionItem(GC_CONSULT_SKIP_HIST_BACK_KEY) === '1') {
            return;
        }

        if (getSessionItem(GC_CONSULT_LIST_RETURN_URL_KEY)) {
            return;
        }

        const referrer = document.referrer;
        if (!referrer) return;

        const path = toSameOriginPath(referrer);
        if (!path) return;
        if (isConsultListOrWritePath(path.split('?')[0])) return;
        if (isCloudflareRelatedUrl(referrer)) return;

        setSessionItem(GC_CONSULT_LIST_RETURN_URL_KEY, path);
    }


    /* =====================================================
       게시판 종류
    ===================================================== */
    function initBoardType($) {
        const $boardWrap = $('.ec-base-table.typeList');
        if ($boardWrap.length === 0) return;

        const currentBoardNo = getCurrentBoardNo($);

        if (currentBoardNo === BOARD_NO_FAQ) {
            $boardWrap.addClass('board-type-faq');
            initFaqAccordion($boardWrap, $);
            return;
        }

        if (currentBoardNo === BOARD_NO_NOTICE) {
            $boardWrap.addClass('board-type-notice');
        }
    }

    function getCurrentBoardNo($) {
        let boardNo = $('input[name="board_no"]').first().val();

        if (!boardNo) {
            boardNo = new URLSearchParams(window.location.search).get('board_no');
        }

        return Number(boardNo);
    }

    /* =====================================================
       공통 카테고리 탭
    ===================================================== */
    function initBoardCategoryTabs($) {
        createSelectTabs($('#board_category'), $, {
            namespace: 'boardCategory',
            useDrag: true,
            useWheel: true,
            triggerChange: true
        });
    }

    // 현재 FAQ 카테고리와 동일하면 true (전체 탭: category_no 없음/빈 문자열)
    function isSameFaqCategory(categoryNo) {
        const currentCategoryNo =
            new URL(window.location.href).searchParams.get('category_no') ||
            '';

        return currentCategoryNo === String(categoryNo || '');
    }

    // FAQ 탭 전환: Cafe24 location.href(push) 대신 replace로 History entry 교체
    // URL은 Cafe24 change handler와 동일 (?board_no=3&category_no={value})
    function navigateFaqCategoryWithoutHistory(categoryNo) {
        window.location.replace(
            '?board_no=' +
                BOARD_NO_FAQ +
                '&category_no=' +
                encodeURIComponent(categoryNo || '')
        );
    }

    function createSelectTabs($select, $, options) {
        if ($select.length === 0 || $select.data('tabified')) return null;

        $select.data('tabified', true);

        const $tabList = $('<ul>', { class: 'category-tab-list inner-m' });
        let activeOption = null;

        $select.find('option').each(function () {
            const $option = $(this);
            const optionData = {
                value: $option.val(),
                label: $option.text().trim(),
                isActive: $option.is(':selected')
            };

            if (optionData.isActive) activeOption = optionData;
            $tabList.append(createTabItem(optionData, $));
        });

        const $tabWrap = $('<div>', { class: 'category-tab-wrap' }).append($tabList);

        $select.addClass('a11y-hidden');
        $select.after($tabWrap);

        if (options.useDrag) initTabDragScroll($tabWrap, $);
        if (options.useWheel) initTabWheelScroll($tabWrap);

        scrollTabIntoView($tabWrap, $tabList.find('.is-active'));

        // 탭 생성 완료 후 페이드 인 (원본 select 깜빡임 방지)
        window.requestAnimationFrame(function () {
            window.requestAnimationFrame(function () {
                $tabWrap.addClass('is-ready');
            });
        });

        $tabWrap.on(
            'click.' + options.namespace,
            '.category-tab-item a',
            function (event) {
                event.preventDefault();

                if ($tabWrap.data('wasDragging')) return;

                const $link = $(this);
                const $item = $link.closest('.category-tab-item');
                const selected = {
                    value: $link.attr('data-value'),
                    label: $link.attr('data-label')
                };

                $tabList.find('.category-tab-item').removeClass('is-active');
                $item.addClass('is-active');
                scrollTabIntoView($tabWrap, $item);

                $select.val(selected.value);
                // if (options.triggerChange) $select.trigger('change');
                if (options.triggerChange) {
                    // FAQ: Cafe24 location.href(push) 대신 replace로 History 교체
                    if (getCurrentBoardNo($) === BOARD_NO_FAQ) {
                        if (isSameFaqCategory(selected.value)) {
                            return;
                        }

                        navigateFaqCategoryWithoutHistory(selected.value);
                        return;
                    }

                    $select.trigger('change');
                }


                if (options.onSelect) options.onSelect(selected);
            }
        );

        return {
            activeOption: activeOption,
            $tabWrap: $tabWrap,
            $tabList: $tabList
        };
    }

    function createTabItem(optionData, $) {
        const $link = $('<a>', {
            href: '#none',
            'data-value': optionData.value,
            'data-label': optionData.label,
            text: optionData.label
        });

        return $('<li>', {
            class: 'category-tab-item' + (optionData.isActive ? ' is-active' : '')
        }).append($link);
    }

    function initTabWheelScroll($tabWrap) {
        const wrapElement = $tabWrap.get(0);

        $tabWrap.on('wheel.boardCategory', function (event) {
            const originalEvent = event.originalEvent;
            if (!originalEvent || originalEvent.deltaY === 0) return;

            event.preventDefault();
            wrapElement.scrollLeft += originalEvent.deltaY;
        });
    }

    function initTabDragScroll($tabWrap, $) {
        const wrapElement = $tabWrap.get(0);
        const namespace = '.tabDrag' + (++dragEventId);
        let isPointerDown = false;
        let startX = 0;
        let initialScrollLeft = 0;

        $tabWrap.on('mousedown' + namespace, function (event) {
            isPointerDown = true;
            startX = event.pageX - wrapElement.offsetLeft;
            initialScrollLeft = wrapElement.scrollLeft;
            $tabWrap.addClass('is-dragging').data('wasDragging', false);
        });

        $(document).on('mousemove' + namespace, function (event) {
            if (!isPointerDown) return;

            event.preventDefault();

            const currentX = event.pageX - wrapElement.offsetLeft;
            const distance = currentX - startX;

            if (Math.abs(distance) > DRAG_THRESHOLD) {
                $tabWrap.data('wasDragging', true);
            }

            wrapElement.scrollLeft = initialScrollLeft - distance;
        });

        $(document).on('mouseup' + namespace + ' mouseleave' + namespace, function () {
            if (!isPointerDown) return;

            isPointerDown = false;
            $tabWrap.removeClass('is-dragging');

            window.setTimeout(function () {
                $tabWrap.data('wasDragging', false);
            }, 0);
        });
    }

    function scrollTabIntoView($tabWrap, $activeTab) {
        if ($activeTab.length === 0) return;

        const wrapElement = $tabWrap.get(0);
        const tabElement = $activeTab.get(0);
        const targetScroll =
            tabElement.offsetLeft -
            wrapElement.clientWidth / 2 +
            tabElement.offsetWidth / 2;

        wrapElement.scrollTo({ left: targetScroll, behavior: 'smooth' });
    }

    /* =====================================================
       FAQ 아코디언
    ===================================================== */
    function initFaqAccordion($boardWrap, $) {
        const $list = $boardWrap.find('.board-list--normal');

        $list.on('click.faqAccordion', '.subject-link', function (event) {
            event.preventDefault();

            const $link = $(this);
            toggleFaqRow($link.closest('tr'), $link.attr('href'), $);
        });
    }

    function toggleFaqRow($row, url, $) {
        const isOpen = $row.hasClass('is-open');

        closeOtherFaqRows($row, $);

        if (isOpen) {
            closeFaqRow($row, $);
            return;
        }

        $row.addClass('is-open');

        if ($row.data('faqHtml')) {
            showFaqAnswer($row, $row.data('faqHtml'), $);
            return;
        }

        const $answerRow = showFaqAnswer($row, '불러오는 중...', $);

        $.ajax({ url: url, type: 'GET', dataType: 'html' })
            .done(function (html) {
                const answerHtml = $(html).find('.detail').html();
                const safeAnswer = answerHtml || '내용을 불러올 수 없습니다.';

                $row.data('faqHtml', safeAnswer);
                $answerRow.find('.faq-answer-inner').html(safeAnswer);
            })
            .fail(function () {
                $answerRow
                    .find('.faq-answer-inner')
                    .text('답변을 불러오는 중 오류가 발생했습니다.');
            });
    }

    function closeOtherFaqRows($row, $) {
        $row.siblings('.is-open').each(function () {
            closeFaqRow($(this), $);
        });
    }

    function closeFaqRow($row, $) {
        $row.removeClass('is-open');
        $row.next('.faq-answer').stop(true, true).slideUp(200, function () {
            $(this).remove();
        });
    }

    function showFaqAnswer($row, html, $) {
        const $answerRow = $('<tr>', { class: 'faq-answer' });
        const $cell = $('<td>', { colspan: 2 });
        const $content = $('<div>', { class: 'faq-answer-inner' }).html(html);

        $answerRow.append($cell.append($content));
        $row.after($answerRow);
        $answerRow.hide().slideDown(200);

        return $answerRow;
    }

    /* =====================================================
       Consult 필터 탭
    ===================================================== */
    function initConsultTabs($) {
        const $select = $('#consult');
        if ($select.length === 0) return;

        const $rows = $('.board-list > tr');
        const result = createSelectTabs($select, $, {
            namespace: 'consultTab',
            useDrag: false,
            useWheel: false,
            triggerChange: false,
            onSelect: function (selected) {
                filterRowsByAnswerStatus($rows, selected.label, $);
            }
        });

        if (result && result.activeOption) {
            filterRowsByAnswerStatus($rows, result.activeOption.label, $);
        }
    }

    function filterRowsByAnswerStatus($rows, label, $) {
        $rows.each(function () {
            const $row = $(this);
            const answerStatus = $row
                .find('.write-count')
                .text()
                .replace('답변', '')
                .trim();
            let shouldShow = true;

            if (label.indexOf('완료') !== -1) {
                shouldShow = answerStatus === 'O';
            } else if (
                label.indexOf('대기') !== -1 ||
                label.indexOf('미답변') !== -1
            ) {
                shouldShow = answerStatus === 'X';
            }

            $row.toggleClass('consult-row-hidden', !shouldShow);
        });
    }

    /* =====================================================
       페이지네이션 끝 버튼 처리
    ===================================================== */
    function initPaging() {
        const pagingWrap = document.querySelector('.ec-base-paginate.typeList');
        if (!pagingWrap) return;

        const prevButton = pagingWrap.querySelector('.paging-prev-button');
        const nextButton = pagingWrap.querySelector('.paging-next-button');
        const currentButton = pagingWrap.querySelector('.this');
        const currentPage = getPageParam(currentButton);

        if (currentPage === null) return;

        disablePagingButtonWhenSamePage(prevButton, currentPage);
        disablePagingButtonWhenSamePage(nextButton, currentPage);
    }

    function getPageParam(button) {
        if (!button) return null;

        const href = button.getAttribute('href');
        if (!href) return null;

        const queryString = href.split('?')[1] || '';
        return new URLSearchParams(queryString).get('page');
    }

    function disablePagingButtonWhenSamePage(button, currentPage) {
        if (!button || getPageParam(button) !== currentPage) return;

        button.classList.add('is-disabled');
        button.setAttribute('aria-disabled', 'true');
    }
})();

(function () {
    'use strict';

    const PROMOTION_BOARD_NO = 8;
    const ENDED_CATEGORY_NO = 2;
    const LIST_URL = '/board/gallery/list.html';
    const JQUERY_WAIT_INTERVAL = 50;
    const JQUERY_WAIT_MAX_TRY = 100;
    const ARTICLE_NO_PATTERN = /\/article\/[^\/]+\/\d+\/(\d+)\//;

    waitForJQuery(init);

    function waitForJQuery(callback, tryCount) {
        const currentTry = tryCount || 0;

        if (window.jQuery) {
            callback(window.jQuery);
            return;
        }

        if (currentTry >= JQUERY_WAIT_MAX_TRY) {
            console.error('[PROMOTION] jQuery 로드 타임아웃 - 종료 뱃지 기능 비활성화');
            return;
        }

        window.setTimeout(function () {
            waitForJQuery(callback, currentTry + 1);
        }, JQUERY_WAIT_INTERVAL);
    }

    function init($) {
        $(function () {
            initPromotionEndedBadge($);
        });
    }

    function initPromotionEndedBadge($) {
        const $promotionList = $('.promotion-list');
        if ($promotionList.length === 0) return;

        if (getCurrentBoardNo($) !== PROMOTION_BOARD_NO) return;

        markEndedItems($promotionList, $);
    }

    function getCurrentBoardNo($) {
        let boardNo = $('input[name="board_no"]').first().val();

        if (!boardNo) {
            boardNo = new URLSearchParams(window.location.search).get('board_no');
        }

        return Number(boardNo);
    }

    function getArticleNo(href) {
        const match = href && href.match(ARTICLE_NO_PATTERN);
        return match ? match[1] : null;
    }

    function markEndedItems($promotionList, $) {
        console.log('[promotion] 종료 목록 조회 시작');

        $.ajax({
            url: LIST_URL,
            data: { board_no: PROMOTION_BOARD_NO, category_no: ENDED_CATEGORY_NO },
            type: 'GET',
            success: function (response) {
                const endedNoSet = {};

                $(response).find('.promotion-list a').each(function () {
                    const no = getArticleNo($(this).attr('href'));
                    if (no) endedNoSet[no] = true;
                });

                console.log('[promotion] 종료 게시물 번호', endedNoSet);

                $promotionList.find('> li').each(function () {
                    const $li = $(this);
                    const no = getArticleNo($li.find('a').attr('href'));
                    $li.find('.thumbnail').toggleClass('is-ended', !!(no && endedNoSet[no]));
                });
            },
            error: function () {
                console.log('[promotion] 종료 목록 조회 실패');
            }
        });
    }
})();