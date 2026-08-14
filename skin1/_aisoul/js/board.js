(function () {
    'use strict';

    var BOARD_NO_NOTICE = 1;
    var BOARD_NO_FAQ = 3;
    var JQUERY_WAIT_INTERVAL = 50;
    var JQUERY_WAIT_MAX_TRY = 100;
    var DRAG_THRESHOLD = 5;
    var WRITE_PAGE_PATH_PATTERN = /\/(write|modify|reply)\.html/;
    var dragEventId = 0;

    waitForJQuery(init);

    function waitForJQuery(callback, tryCount) {
        var currentTry = tryCount || 0;

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
            initFixedWriteBtn($);
        });
    }

    function isWritePage() {
        return WRITE_PAGE_PATH_PATTERN.test(window.location.pathname);
    }

    /* =====================================================
       게시판 종류
    ===================================================== */
    function initBoardType($) {
        var $boardWrap = $('.ec-base-table.typeList');
        if ($boardWrap.length === 0) return;

        var currentBoardNo = getCurrentBoardNo($);

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
        var boardNo = $('input[name="board_no"]').first().val();

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

    function createSelectTabs($select, $, options) {
        if ($select.length === 0 || $select.data('tabified')) return null;

        $select.data('tabified', true);

        var $tabList = $('<ul>', { class: 'category-tab-list inner-m' });
        var activeOption = null;

        $select.find('option').each(function () {
            var $option = $(this);
            var optionData = {
                value: $option.val(),
                label: $option.text().trim(),
                isActive: $option.is(':selected')
            };

            if (optionData.isActive) activeOption = optionData;
            $tabList.append(createTabItem(optionData, $));
        });

        var $tabWrap = $('<div>', { class: 'category-tab-wrap' }).append($tabList);

        $select.addClass('a11y-hidden');
        $select.after($tabWrap);

        if (options.useDrag) initTabDragScroll($tabWrap, $);
        if (options.useWheel) initTabWheelScroll($tabWrap);

        scrollTabIntoView($tabWrap, $tabList.find('.is-active'));

        $tabWrap.on(
            'click.' + options.namespace,
            '.category-tab-item a',
            function (event) {
                event.preventDefault();

                if ($tabWrap.data('wasDragging')) return;

                var $link = $(this);
                var $item = $link.closest('.category-tab-item');
                var selected = {
                    value: $link.attr('data-value'),
                    label: $link.attr('data-label')
                };

                $tabList.find('.category-tab-item').removeClass('is-active');
                $item.addClass('is-active');
                scrollTabIntoView($tabWrap, $item);

                $select.val(selected.value);
                if (options.triggerChange) $select.trigger('change');
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
        var $link = $('<a>', {
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
        var wrapElement = $tabWrap.get(0);

        $tabWrap.on('wheel.boardCategory', function (event) {
            var originalEvent = event.originalEvent;
            if (!originalEvent || originalEvent.deltaY === 0) return;

            event.preventDefault();
            wrapElement.scrollLeft += originalEvent.deltaY;
        });
    }

    function initTabDragScroll($tabWrap, $) {
        var wrapElement = $tabWrap.get(0);
        var namespace = '.tabDrag' + (++dragEventId);
        var isPointerDown = false;
        var startX = 0;
        var initialScrollLeft = 0;

        $tabWrap.on('mousedown' + namespace, function (event) {
            isPointerDown = true;
            startX = event.pageX - wrapElement.offsetLeft;
            initialScrollLeft = wrapElement.scrollLeft;
            $tabWrap.addClass('is-dragging').data('wasDragging', false);
        });

        $(document).on('mousemove' + namespace, function (event) {
            if (!isPointerDown) return;

            event.preventDefault();

            var currentX = event.pageX - wrapElement.offsetLeft;
            var distance = currentX - startX;

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

        var wrapElement = $tabWrap.get(0);
        var tabElement = $activeTab.get(0);
        var targetScroll =
            tabElement.offsetLeft -
            wrapElement.clientWidth / 2 +
            tabElement.offsetWidth / 2;

        wrapElement.scrollTo({ left: targetScroll, behavior: 'smooth' });
    }

    /* =====================================================
       FAQ 아코디언
    ===================================================== */
    function initFaqAccordion($boardWrap, $) {
        var $list = $boardWrap.find('.board-list--normal');

        $list.on('click.faqAccordion', '.subject-link', function (event) {
            event.preventDefault();

            var $link = $(this);
            toggleFaqRow($link.closest('tr'), $link.attr('href'), $);
        });
    }

    function toggleFaqRow($row, url, $) {
        var isOpen = $row.hasClass('is-open');

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

        var $answerRow = showFaqAnswer($row, '불러오는 중...', $);

        $.ajax({ url: url, type: 'GET', dataType: 'html' })
            .done(function (html) {
                var answerHtml = $(html).find('.detail').html();
                var safeAnswer = answerHtml || '내용을 불러올 수 없습니다.';

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
        var $answerRow = $('<tr>', { class: 'faq-answer' });
        var $cell = $('<td>', { colspan: 2 });
        var $content = $('<div>', { class: 'faq-answer-inner' }).html(html);

        $answerRow.append($cell.append($content));
        $row.after($answerRow);
        $answerRow.hide().slideDown(200);

        return $answerRow;
    }

    /* =====================================================
       Consult 필터 탭
    ===================================================== */
    function initConsultTabs($) {
        var $select = $('#consult');
        if ($select.length === 0) return;

        var $rows = $('.board-list > tr');
        var result = createSelectTabs($select, $, {
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
            var $row = $(this);
            var answerStatus = $row
                .find('.write-count')
                .text()
                .replace('답변', '')
                .trim();
            var shouldShow = true;

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
        var pagingWrap = document.querySelector('.ec-base-paginate.typeList');
        if (!pagingWrap) return;

        var prevButton = pagingWrap.querySelector('.paging-prev-button');
        var nextButton = pagingWrap.querySelector('.paging-next-button');
        var currentButton = pagingWrap.querySelector('.this');
        var currentPage = getPageParam(currentButton);

        if (currentPage === null) return;

        disablePagingButtonWhenSamePage(prevButton, currentPage);
        disablePagingButtonWhenSamePage(nextButton, currentPage);
    }

    function getPageParam(button) {
        if (!button) return null;

        var href = button.getAttribute('href');
        if (!href) return null;

        var queryString = href.split('?')[1] || '';
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

    var PROMOTION_BOARD_NO = 8;
    var ENDED_CATEGORY_NO = 2;
    var LIST_URL = '/board/gallery/list.html';
    var JQUERY_WAIT_INTERVAL = 50;
    var JQUERY_WAIT_MAX_TRY = 100;
    var ARTICLE_NO_PATTERN = /\/article\/[^\/]+\/\d+\/(\d+)\//;

    waitForJQuery(init);

    function waitForJQuery(callback, tryCount) {
        var currentTry = tryCount || 0;

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
        var $promotionList = $('.promotion-list');
        if ($promotionList.length === 0) return;

        if (getCurrentBoardNo($) !== PROMOTION_BOARD_NO) return;

        markEndedItems($promotionList, $);
    }

    function getCurrentBoardNo($) {
        var boardNo = $('input[name="board_no"]').first().val();

        if (!boardNo) {
            boardNo = new URLSearchParams(window.location.search).get('board_no');
        }

        return Number(boardNo);
    }

    function getArticleNo(href) {
        var match = href && href.match(ARTICLE_NO_PATTERN);
        return match ? match[1] : null;
    }

    function markEndedItems($promotionList, $) {
        console.log('[promotion] 종료 목록 조회 시작');

        $.ajax({
            url: LIST_URL,
            data: { board_no: PROMOTION_BOARD_NO, category_no: ENDED_CATEGORY_NO },
            type: 'GET',
            success: function (response) {
                var endedNoSet = {};

                $(response).find('.promotion-list a').each(function () {
                    var no = getArticleNo($(this).attr('href'));
                    if (no) endedNoSet[no] = true;
                });

                console.log('[promotion] 종료 게시물 번호', endedNoSet);

                $promotionList.find('> li').each(function () {
                    var $li = $(this);
                    var no = getArticleNo($li.find('a').attr('href'));
                    $li.find('.thumbnail').toggleClass('is-ended', !!(no && endedNoSet[no]));
                });
            },
            error: function () {
                console.log('[promotion] 종료 목록 조회 실패');
            }
        });
    }
})();