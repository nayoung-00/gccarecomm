(function () {
    'use strict';
    /**
     * 상품상세 커스텀 JS
     *
     * - 상품정보 테이블 클래스
     * - 상품요약정보 칩
     * - 상품 이미지 드래그
     * - 상품 상세 팝업
     * - 상세설명 펼쳐보기
     * - 상품정보고시
     * - Q&A
     * - 하단 고정 구매바 / 옵션 바텀시트
     * - 상세 탭 스크롤
     *
     * [상품정보고시]
     * - health : 건강기능식품
     * - food : 일반식품
     * - NOTICE_FIELDS : 유형별 노출 항목
     * - NOTICE_FIELD_ALIASES : 외부 데이터 필드명 매핑
     *
     * [임시 건기식 분기]
     * - DEMO_HEALTH_PRODUCT_NAME : 시안 확인용 상품
     * - isDemoHealthProduct() : 임시 상품 판별
     * - 고시 fallback / 네이버페이 혜택 : 현재 데모 상품만 노출
     * - 실제 데이터 연동 시 임시 상품명 분기 제거 필요
     *
     * [구매 바텀시트]
     * - Cafe24 원본 옵션 / 수량 / 가격 / 구매 기능 사용
     * - 단일상품 : 기본 상품 행 사용
     * - 옵션상품 : option_product / add_product 사용
     * - 옵션 미선택 : 0원 / 0개
     * - 단일상품 금액 : #totalPrice 기준
     * - Cafe24 옵션 DOM 갱신 후 시트 재생성
     * - 모바일 필수 옵션 미선택 시 Cafe24 기본 옵션 레이어 대신 PC와 동일하게 알럿 노출
     * (initFixedPurchase > hasRequiredOptionSelected / requiredOptionGuardBound)
     *
     */

    /**
     * [업데이트]
     * 260814 :: 상태칩 1차 -> 보류(initSummaryChips 주석)
     * 
     */


    var JQUERY_WAIT_INTERVAL = 50;
    var JQUERY_WAIT_MAX_TRY = 100;
    var SUMMARY_CHIP_COLOR_COUNT = 5;
    var DETAIL_TAB_SCROLL_OFFSET = 60;
    var SCROLL_SPY_ANIMATION_GUARD_MS = 500;
    var REQUIRED_OPTION_ALERT_MESSAGE = '옵션을 선택해 주세요.';
    // 임시 건기식 시안 확인용: 실제 Cafe24 고시 데이터/건기식 분기 연동 후 삭제
    var DEMO_HEALTH_PRODUCT_NAME =
        'gc녹십자웰빙pnt액상-마그네슘-플러스-20ml-x-30포-x-1박스1개월분-망고맛-저당설계';

    var PRODUCT_INFO_LABEL_CLASS_MAP = {
        '상품명': 'prd-name',
        '상품요약정보': 'prd-summary',
        '소비자가': 'prd-consumer-price',
        '정가': 'prd-consumer-price',
        '판매가': 'prd-sale-price',
        '구매가': 'prd-sale-price',
        '배송비': 'prd-delivery-fee'
    };

    var NOTICE_FIELDS = {
        health: [
            { key: 'productName', label: '제품명' },
            { key: 'manufacturer', label: '제조업소' },
            { key: 'origin', label: '소재지' },
            { key: 'expiration', label: '소비기한' },
            { key: 'storage', label: '보관방법' },
            { key: 'content', label: '내용량·수량' },
            { key: 'packageUnit', label: '포장 단위별 수량' },
            { key: 'ingredients', label: '원료명 및 함량' },
            { key: 'nutrition', label: '영양정보' },
            { key: 'functionInfo', label: '기능정보' },
            { key: 'intake', label: '섭취량·방법·주의사항' },
            { key: 'medicine', label: '의약품 여부' },
            { key: 'gmoHealth', label: '유전자변형건강기능식품 여부' },
            { key: 'importReport', label: '수입신고 여부' },
            { key: 'safetyWarning', label: '소비자안전 주의사항' },
            { key: 'customerService', label: '소비자상담 전화번호' }
        ],
        food: [
            { key: 'productName', label: '제품명' },
            { key: 'foodType', label: '식품의 유형' },
            { key: 'manufacturer', label: '생산자' },
            { key: 'origin', label: '소재지' },
            { key: 'manufactureDate', label: '제조연월일' },
            { key: 'expiration', label: '소비기한 또는 품질유지기한' },
            { key: 'content', label: '내용량·수량' },
            { key: 'packageUnit', label: '포장 단위별 수량' },
            { key: 'ingredients', label: '원재료명 및 함량' },
            { key: 'nutrition', label: '영양성분' },
            { key: 'gmo', label: '유전자변형식품 여부' },
            { key: 'safetyWarning', label: '소비자안전 주의사항' },
            { key: 'importReport', label: '수입신고 여부' },
            { key: 'customerService', label: '소비자상담 전화번호' }
        ]
    };

    var NOTICE_TYPE_MAP = {
        health: 'health',
        '건강기능식품': 'health',
        food: 'food',
        '일반식품': 'food'
    };

    var NOTICE_FIELD_ALIASES = {
        productName: ['productName', 'name', 'product_name'],
        foodType: ['foodType', 'food_type'],
        manufacturer: ['manufacturer', 'manufacturerName', 'maker', 'producer'],
        origin: ['origin', 'originPlace', 'address'],
        manufactureDate: ['manufactureDate', 'manufacturedAt', 'productionDate'],
        expiration: ['expiration', 'expiryDate', 'bestBefore'],
        storage: ['storage', 'storageMethod'],
        content: ['content', 'quantity', 'volume'],
        packageUnit: ['packageUnit', 'packageQuantity'],
        ingredients: ['ingredients', 'ingredient'],
        nutrition: ['nutrition', 'nutritionInfo'],
        functionInfo: ['functionInfo', 'functionalInfo'],
        intake: ['intake', 'intakeMethod'],
        medicine: ['medicine', 'isMedicine'],
        gmoHealth: ['gmoHealth', 'isGmoHealth'],
        gmo: ['gmo', 'isGmo'],
        importReport: ['importReport', 'isImported'],
        safetyWarning: ['safetyWarning', 'warning'],
        customerService: ['customerService', 'customerServicePhone', 'servicePhone']
    };

    waitForJQuery(init);

    function waitForJQuery(callback, tryCount) {
        var currentTry = tryCount || 0;

        if (window.jQuery) {
            callback(window.jQuery);
            return;
        }

        if (currentTry >= JQUERY_WAIT_MAX_TRY) {
            console.error('[DETAIL] jQuery 로드 타임아웃 - 상품상세 커스텀 기능 비활성화');
            return;
        }

        window.setTimeout(function () {
            waitForJQuery(callback, currentTry + 1);
        }, JQUERY_WAIT_INTERVAL);
    }

    function runAtDelays(fn, delays) {
        delays.forEach(function (delay) {
            window.setTimeout(fn, delay);
        });
    }

    /*
    * 임시 시안 확인용입니다.
    * PNT 액상 마그네슘 플러스에서만 고시/네이버페이 영역을 노출합니다.
    * 실제 건기식 분기/API 연동 시 이 함수를 교체하거나 삭제해 주세요.
    */
    function isDemoHealthProduct() {
        var pathParts = window.location.pathname.split('/');
        var productPathIndex = pathParts.indexOf('product');
        var productName = productPathIndex === -1 ? '' : (pathParts[productPathIndex + 1] || '');

        try {
            productName = decodeURIComponent(productName);
        } catch (error) {
            // 인코딩이 깨진 URL은 원본 문자열로 비교
        }
        return productName === DEMO_HEALTH_PRODUCT_NAME;
    }

    function init($) {
        $(function () {
            initProductInfoTable($);
            initProductNotice();
            //   initSummaryChips($);
            initDetailLayout($);
            initDetailPopup();
            initProductImageDrag($);
            initDemoHealthBenefit($);
            initFixedPurchase($);
            initProductDetailMore($);
            initQnaList($);
            initDetailTabScroll($);
        });
    }

    /* 상품정보고시 */
    function initProductNotice() {
        var notice = document.getElementById('productNotice');
        if (!notice) return;

        var rawData = getProductNoticeData();
        var data = normalizeNoticeData(rawData);
        if (!data || !NOTICE_FIELDS[data.type]) return;

        renderProductNotice(notice, data);
        initProductNoticeToggle(notice);
        notice.hidden = false;
    }

    function getProductNoticeData() {
        var noticeData = window.PRODUCT_NOTICE_DATA || window.productNoticeData || window.__PRODUCT_NOTICE_DATA__;
        if (noticeData) return noticeData;

        // 임시 건기식 고시 fallback: 실제 데이터 연동 후 삭제
        return isDemoHealthProduct() ? {
            type: 'health',
            productName: 'GC녹십자웰빙 PNT 액상 마그네슘 플러스'
        } : null;
    }

    function normalizeNoticeData(rawData) {
        if (!rawData || typeof rawData !== 'object') return null;

        var source = rawData.productNotice || rawData.notice || rawData;
        if (!source || typeof source !== 'object') return null;

        var rawType = source.type || source.productType || source.noticeType;
        var type = NOTICE_TYPE_MAP[typeof rawType === 'string' ? rawType.trim() : rawType];
        if (!type) return null;

        var normalized = { type: type };

        Object.keys(NOTICE_FIELD_ALIASES).forEach(function (key) {
            var sourceKey = NOTICE_FIELD_ALIASES[key].find(function (candidate) {
                return Object.prototype.hasOwnProperty.call(source, candidate);
            });
            normalized[key] = sourceKey ? source[sourceKey] : null;
        });
        return normalized;
    }

    function formatNoticeValue(value) {
        return value === null || value === undefined || (typeof value === 'string' && value.trim() === '') ? '-' : String(value);
    }

    function renderProductNotice(notice, data) {
        var list = notice.querySelector('.product-notice__list');
        if (!list) return;

        list.textContent = '';
        NOTICE_FIELDS[data.type].forEach(function (field) {
            var item = document.createElement('div');
            var term = document.createElement('dt');
            var description = document.createElement('dd');

            item.className = 'product-notice__item';
            term.textContent = field.label;
            description.textContent = formatNoticeValue(data[field.key]);
            item.appendChild(term);
            item.appendChild(description);
            list.appendChild(item);
        });
    }

    function initProductNoticeToggle(notice) {
        var button = notice.querySelector('.product-notice__toggle');
        var label = button && button.querySelector('span');
        if (!button || !label) return;

        notice.classList.add('is-collapsed');
        button.setAttribute('aria-expanded', 'false');
        label.textContent = '상품정보 펼쳐보기';

        if (button.dataset.noticeToggleBound === 'true') return;

        button.dataset.noticeToggleBound = 'true';
        button.addEventListener('click', function () {
            var isCollapsed = notice.classList.toggle('is-collapsed');
            button.setAttribute('aria-expanded', String(!isCollapsed));
            label.textContent = isCollapsed ? '상품정보 펼쳐보기' : '상품정보 접기';
        });
    }

    /* 상세설명 펼쳐보기 버튼 */
    function initProductDetailMore($) {
        var LIMIT_HEIGHT = 1000;
        var $detail = $('#prdDetail .prd-detail-content').first();
        var $buttonWrap = $('#prdDetail .prd-detail-more-wrap').first();
        var $button = $buttonWrap.find('.prd-detail-more-btn').first();
        if (!$detail.length || !$buttonWrap.length || !$button.length) return;

        function getRealHeight() {
            var height = Math.max($detail[0].scrollHeight, $detail.outerHeight() || 0);
            $detail.find('img').each(function () {
                height = Math.max(height, this.naturalHeight || 0);
            });
            return height;
        }

        function setup() {
            if ($detail.data('expanded')) return;
            $detail.css({ maxHeight: 'none', overflow: 'visible' });

            if (getRealHeight() <= LIMIT_HEIGHT) {
                $buttonWrap.removeClass('is-visible').hide();
                return;
            }

            $detail.css({ maxHeight: LIMIT_HEIGHT + 'px', overflow: 'hidden' });
            $buttonWrap.addClass('is-visible').show();
        }

        $button.off('click.prdDetailMore').on('click.prdDetailMore', function () {
            $detail.data('expanded', true).css({ maxHeight: 'none', overflow: 'visible' });
            $button.attr('aria-expanded', 'true');
            $buttonWrap.removeClass('is-visible').hide();
        });

        $detail.find('img').each(function () {
            if (!this.complete) $(this).off('load.prdDetailMore').one('load.prdDetailMore', setup);
        });
        runAtDelays(setup, [0, 250, 700, 1500]);
    }

    /* Q&A */
    function initQnaList($) {
        var $qna = $('#prdQnA');
        if (!$qna.length) return;

        var lastQnaLink = null;
        var qnaLoadingTimer = null;
        var $qnaLoading = $qna.children('.qna-auth-loading').first();

        if (!$qnaLoading.length) {
            $qnaLoading = $('<div class="qna-auth-loading" role="status" aria-live="polite">' +
                '<span class="qna-auth-spinner" aria-hidden="true"></span>' +
                '<span>문의 내용을 불러오는 중입니다.</span>' +
                '</div>').appendTo($qna);
        }

        function isInCommentWriteForm($el) {
            return $el.closest('form[id^="commentWriteForm"]').length > 0;
        }

        function setQnaLoading(show) {
            window.clearTimeout(qnaLoadingTimer);
            $qnaLoading.toggleClass('is-visible', show);
            if (show) {
                qnaLoadingTimer = window.setTimeout(function () {
                    $qnaLoading.removeClass('is-visible');
                }, 5000);
            }
        }
        $qna.find('.xans-product-qna tbody > tr').each(function () {
            var $cells = $(this).children('td');
            $cells.eq(2).addClass('qna-subject');
            $cells.eq(3).addClass('qna-writer');
            $cells.eq(4).addClass('qna-date');
        });

        function validateQnaRead() {
            var $read = $qna.find('#product-qna-read');
            if (!$read.length) return;

            var answerCount = parseInt(
                $read.find('[onclick*="comment_view"] em').first().text(),
                10
            ) || 0;
            var $article = $read.find('.fr-view-article').first();
            var hasQuestionContent = $.trim($article.text()).length > 0 ||
                $article.find('img, video, iframe, audio').length > 0;
            var hasAnswerContent = $read.find('.boardComment li, .commentList li').length > 0;
            var hasSecretAccessForm = $read.find(
                'input[type="password"], .password, .secret, form[action*="Password"], form[action*="password"]'
            ).filter(function () {
                return !isInCommentWriteForm($(this));
            }).length > 0;
            var hasReadableContent = hasQuestionContent || answerCount > 0 ||
                hasAnswerContent || hasSecretAccessForm;

            if (hasQuestionContent) setQnaLoading(false);

            $read.toggleClass('has-qna-content', hasReadableContent);
            if (!hasReadableContent) {
                $read.hide();
                return;
            }

            $read.show();
        }

        $qna.off('click.qnaReadGuard', '.qna-subject a').on('click.qnaReadGuard', '.qna-subject a', function () {
            lastQnaLink = this;
            runAtDelays(validateQnaRead, [50, 200, 500]);
        });

        var secretReopenTimer = null;
        function reopenQnaAfterSecretAuth() {
            window.clearTimeout(secretReopenTimer);
            setQnaLoading(true);
            secretReopenTimer = window.setTimeout(function () {
                if (!lastQnaLink) return;
                $(lastQnaLink).trigger('click');
                runAtDelays(validateQnaRead, [100, 300, 700]);
            }, 700);
        }

        $(document).off('click.qnaSecretAuth').on('click.qnaSecretAuth', 'a, button, input[type="submit"], input[type="button"]', function () {
            if (!lastQnaLink || isInCommentWriteForm($(this))) return;
            var $visiblePassword = $('input[type="password"]:visible').filter(function () {
                return !isInCommentWriteForm($(this));
            });
            if (!$visiblePassword.length) return;
            reopenQnaAfterSecretAuth();
        });

        $(document).off('keydown.qnaSecretAuth').on('keydown.qnaSecretAuth', 'input[type="password"]', function (event) {
            if (event.key !== 'Enter' || isInCommentWriteForm($(this))) return;
            reopenQnaAfterSecretAuth();
        });

        var qnaTarget = $qna.find('.xans-product-qna').get(0);
        if (qnaTarget && window.MutationObserver) {
            if (qnaTarget.__qnaReadObserver) qnaTarget.__qnaReadObserver.disconnect();

            qnaTarget.__qnaReadObserver = new MutationObserver(validateQnaRead);
            qnaTarget.__qnaReadObserver.observe(qnaTarget, {
                childList: true,
                subtree: true
            });
        }
        validateQnaRead();
    }

    /* 네이버페이 리워드 / 실구매가 (임시 데모 상품 전용) */
    function initDemoHealthBenefit($) {
        var NAVER_PAY_BENEFIT = 4000;
        var $benefit = $('#npayBenefitBanner');
        var $footerNpay = $('#npayFooterSlot');

        if (!isDemoHealthProduct()) {
            $benefit.empty();
            $footerNpay.empty();
            $('.prd-actual-price').remove();
            return;
        }

        function getPrice($target) {
            var value = String($target.text() || '').replace(/[^0-9]/g, '');
            return Number(value) || 0;
        }

        function formatPrice(value) {
            return Math.max(0, value).toLocaleString('ko-KR') + '원';
        }

        var $detailDesign = $('.xans-product-detaildesign:visible').first();
        var $saleRow = $detailDesign
            .find('tr.prd-sale-price')
            .filter(':visible')
            .first();

        var salePrice = getPrice($saleRow.find('td').first());
        var actualPrice = salePrice - NAVER_PAY_BENEFIT;

        $benefit.html(
            '<div class="npay-benefit-inner">' +
            '<strong>네이버페이</strong>' +
            '<span><b>' +
            formatPrice(NAVER_PAY_BENEFIT) +
            '</b> 지급</span>' +
            '<span class="price-tooltip">' +
            '<button type="button" class="price-tooltip-trigger" ' +
            'aria-label="네이버페이 혜택 안내">?</button>' +
            '<span class="price-tooltip-panel" role="tooltip">복용 체크 완료 시 네이버페이로 지급되는 리워드 금액</span>' +
            '</span>' +
            '</div>'
        );

        if ($saleRow.length) {
            $detailDesign.find('.prd-actual-price').remove();

            var $actualRow = $(
                '<tr class="prd-actual-price">' +
                '<th scope="row">' +
                '<span class="actual-price-label">실구매가</span>' +
                '<span class="price-tooltip">' +
                '<button type="button" class="price-tooltip-trigger" ' +
                'aria-label="실구매가 안내">?</button>' +
                '<span class="price-tooltip-panel" role="tooltip">네이버페이 리워드를 지급받았을 때의 실제 구매 가격</span>' +
                '</span>' +
                '</th>' +
                '<td>' +
                '<strong class="actual-price-value">' +
                formatPrice(actualPrice) +
                '</strong>' +
                '</td>' +
                '</tr>'
            );

            $actualRow.insertAfter($saleRow);
        }

        $footerNpay.html(
            '<button type="button" class="npay-fixed-button" ' +
            'aria-label="네이버페이 결제">' +
            '<span class="npay-mark">N</span>' +
            '<span>pay</span>' +
            '</button>'
        );
    }

    // 슬라이드 그랩
    function initProductImageDrag($) {
        var $slider = $('.xans-product-mobileimage').first();
        if (!$slider.length) return;

        var startX = 0;
        var currentX = 0;
        var dragging = false;
        var dragged = false;

        function getCafe24Slider() {
            var id = $slider.attr('id') || '';
            return window['$' + id.replace(/-/g, '_')];
        }

        $slider.off('.productImageDrag');
        $(document).off('.productImageDrag');

        $slider.on('mousedown.productImageDrag', function (event) {
            if (event.which !== 1) return;
            startX = currentX = event.clientX;
            dragging = true;
            dragged = false;
            $slider.addClass('is-grabbing');
            event.preventDefault();
        });

        $(document).on('mousemove.productImageDrag', function (event) {
            if (!dragging) return;
            currentX = event.clientX;
            if (Math.abs(currentX - startX) > 6) dragged = true;
        }).on('mouseup.productImageDrag', function () {
            if (!dragging) return;
            var distance = currentX - startX;
            var cafe24Slider = getCafe24Slider();
            dragging = false;
            $slider.removeClass('is-grabbing');

            if (Math.abs(distance) < 45 || !cafe24Slider) return;
            if (distance < 0 && typeof cafe24Slider.next === 'function') cafe24Slider.next();
            if (distance > 0 && typeof cafe24Slider.prev === 'function') cafe24Slider.prev();
        });

        $slider.on('click.productImageDrag', 'a, img', function (event) {
            if (!dragged) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            dragged = false;
        }).on('dragstart.productImageDrag', 'img', function () {
            return false;
        });
    }

    /* 상품 요약 레이아웃 */
    function initDetailLayout($) {
        var $summary = $('.xans-product-detaildesign tr.prd-summary').first();
        var $heading = $('.xans-product-detail .headingArea').first();
        var $imageArea = $('.xans-product-detail .imgArea').first();
        var hasMobileSliderImage = $imageArea.find('.xans-product-mobileimage li img').length > 0;

        $imageArea.toggleClass('has-mobile-slider', hasMobileSliderImage);

        // Cafe24 모바일 슬라이더는 resize 시점에 레이아웃을 다시 계산합니다.
        if (hasMobileSliderImage) {
            var triggerNativeResize = function () {
                try {
                    window.dispatchEvent(new Event('resize'));
                } catch (e) {
                    var evt = document.createEvent('UIEvent');
                    evt.initUIEvent('resize', true, false, window, 0);
                    window.dispatchEvent(evt);
                }
            };

            runAtDelays(triggerNativeResize, [0, 150, 500, 1200, 2000]);

            if (document.readyState === 'complete') {
                triggerNativeResize();
            } else {
                $(window).off('load.mobileSliderRelayout').on('load.mobileSliderRelayout', triggerNativeResize);
            }

            $imageArea.find('.xans-product-mobileimage img').each(function () {
                if (this.complete) return;
                $(this).off('.mobileSliderRelayout')
                    .on('load.mobileSliderRelayout error.mobileSliderRelayout', triggerNativeResize);
            });
        }

        if ($summary.length && $heading.length) {
            var $summaryContent = $summary.find('td').first().children().detach();
            if (!$summaryContent.length) $summaryContent = $('<span></span>').text($summary.find('td').text().trim());
            $('<div class="detail-summary"></div>').append($summaryContent).insertBefore($heading);
            $summary.remove();
        }

        $('.xans-product-mobileimage > ul').attr('aria-label', '상품 이미지 슬라이드');
        $('.xans-product-mobileimage > ul > li').each(function (index) {
            $(this).attr('aria-label', (index + 1) + '번째 상품 이미지');
        });
    }

    // 상세 이미지 팝업
    function initDetailPopup() {
        var layer = document.createElement('div');
        var sheet = document.createElement('div');
        var scrollArea = document.createElement('div');
        var closeButton = document.createElement('button');

        layer.className = 'detail-popup-layer';
        sheet.className = 'detail-popup-sheet';
        scrollArea.className = 'detail-popup-scroll';
        closeButton.className = 'detail-popup-close';

        closeButton.type = 'button';
        closeButton.setAttribute('aria-label', '팝업 닫기');

        sheet.appendChild(closeButton);
        sheet.appendChild(scrollArea);
        layer.appendChild(sheet);
        document.body.appendChild(layer);

        function openPopup(trigger) {
            var detailContent = trigger.closest('.prd-detail-content');
            if (!detailContent) return;

            var popupContent = detailContent.querySelector('.detail-popup__box');
            if (!popupContent) return;

            var popupClone = popupContent.cloneNode(true);
            var images = popupClone.querySelectorAll('img[ec-data-src]');

            images.forEach(function (image) {
                var originalSrc = image.getAttribute('ec-data-src');
                if (originalSrc) image.src = originalSrc;
            });

            scrollArea.replaceChildren(popupClone);
            scrollArea.scrollTop = 0;

            document.documentElement.classList.add('detail-popup-open');
            document.body.classList.add('detail-popup-open');
            layer.classList.add('is-open');

            closeButton.focus();
        }

        function closePopup() {
            layer.classList.remove('is-open');
            document.documentElement.classList.remove('detail-popup-open');
            document.body.classList.remove('detail-popup-open');
        }

        document.addEventListener('click', function (event) {
            var trigger = event.target.closest('.detail-img__trigger-btn');
            if (!trigger) return;

            event.preventDefault();
            event.stopPropagation();

            openPopup(trigger);
        });
        closeButton.addEventListener('click', closePopup);

        layer.addEventListener('click', function (event) {
            if (event.target === layer) closePopup();
        });

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && layer.classList.contains('is-open')) closePopup();
        });
    }

    /* 하단 구매 고정 바 */
    function initFixedPurchase($) {
        var $fixed = $('#prodOrderFixArea');
        var $origin = $('.productAction').first();
        var $layer = $('#fixedOptionLayer');
        var $content = $('#fixedOptionContent');
        var $actions = $('#fixedOptionActions');
        if (!$fixed.length || !$origin.length || !$layer.length || !$content.length || !$actions.length) return;

        $fixed.find('.actionCart').text('장바구니');
        $fixed.find('.fixed-btn-fill').first().text('구매하기');
        var $soldoutSource = $origin.find('.sub_sold').first();
        var isSoldOut = $soldoutSource.length && !$soldoutSource.hasClass('displaynone');
        $fixed.toggleClass('is-soldout', isSoldOut);
        $fixed.addClass('is-ready').attr('aria-hidden', 'true');

        // 필수 옵션 선택 여부 확인 (옵션상품/세트상품 미선택 시 false)
        function hasRequiredOptionSelected() {
            var $sourceSelected = $('#totalProducts');
            if (!$sourceSelected.length) return true;

            var $productOptions = $('.xans-product-detail .infoArea').first()
                .children('.xans-product-option')
                .find('select');
            if (!$productOptions.length) return true;

            return $sourceSelected.find('tr.option_product, tr.add_product').length > 0;
        }

        // 카페24 기본 "구매하기" 버튼(원본)은 모바일에서 옵션 미선택 시 옵션 레이어를 띄우므로,
        // PC와 동일하게 알럿으로 안내하도록 클릭을 캡처링 단계에서 가로챈다.
        // 하단 고정바의 구매하기 버튼도 이 원본 버튼을 프로그래밍적으로 클릭하므로 함께 처리된다.
        if (!$origin.data('requiredOptionGuardBound')) {
            $origin.data('requiredOptionGuardBound', true);
            $origin.get(0).addEventListener('click', function (event) {
                var buyLink = event.target.closest && event.target.closest('a.btnSubmit.sizeL');
                if (!buyLink || hasRequiredOptionSelected()) return;

                event.preventDefault();
                event.stopImmediatePropagation();
                window.alert(REQUIRED_OPTION_ALERT_MESSAGE);
            }, true);
        }

        var fixedStart = 0;

        function calculateFixedStart() {
            if (!$origin.length) return;
            fixedStart = $origin.offset().top + $origin.outerHeight();
        }

        function updateFixedVisibility() {
            var show = $(window).scrollTop() >= fixedStart;
            $fixed.toggleClass('is-visible', show).attr('aria-hidden', show ? 'false' : 'true');
        }

        calculateFixedStart();
        $(window).off('scroll.fixedPurchase').on('scroll.fixedPurchase', updateFixedVisibility);
        $(window).off('resize.fixedPurchase load.fixedPurchase').on('resize.fixedPurchase load.fixedPurchase', function () {
            calculateFixedStart();
            updateFixedVisibility();
        });
        var resizeObserver = $fixed.data('fixedPurchaseResizeObserver');
        if (resizeObserver) resizeObserver.disconnect();

        if (window.ResizeObserver) {
            resizeObserver = new ResizeObserver(function () {
                calculateFixedStart();
                updateFixedVisibility();
            });
            resizeObserver.observe($origin[0]);
            $fixed.data('fixedPurchaseResizeObserver', resizeObserver);
        }
        window.clearTimeout($fixed.data('fixedPurchaseStartTimer'));
        $fixed.data('fixedPurchaseStartTimer', window.setTimeout(calculateFixedStart, 300));
        updateFixedVisibility();

        // 카페24 옵션 DOM 갱신 대응
        function scheduleSheetRefresh() {
            runAtDelays(function () {
                if ($layer.hasClass('is-open')) buildSheet();
            }, [60, 220, 500]);
        }

        // 원본 select / 시트 select
        function appendOptionFields() {
            var $sourceOptions = $('.xans-product-detail .infoArea').first()
                .children('.xans-product-option, .productSet').find('select');
            if (!$sourceOptions.length) return;

            var $fields = $('<div class="fixed-option-fields"></div>');
            $sourceOptions.each(function (index) {
                var $source = $(this);
                var sourceId = this.id || '';
                var isAddProduct = $source.closest('.productSet').length > 0;
                var label = $source.closest('tr').find('th').first().text().trim() ||
                    $source.closest('li').find('.name').first().text().trim() || '옵션 선택';
                var $field = $('<div class="fixed-option-field"></div>');
                var $select = $('<select class="fixed-option-select"></select>')
                    .html($source.html())
                    .val($source.val())
                    .attr('aria-label', label)
                    .attr('data-source-index', index)
                    .attr('data-source-id', sourceId)
                    .attr('data-option-kind', isAddProduct ? 'addproduct' : 'product');

                $('<span class="fixed-option-label"></span>').text(label).appendTo($field);
                $select.appendTo($field);
                $field.appendTo($fields);
            });

            $fields.on('change', '.fixed-option-select', function () {
                var sourceId = $(this).attr('data-source-id');
                var sourceIndex = Number($(this).attr('data-source-index'));
                var source = sourceId ? document.getElementById(sourceId) : $sourceOptions.get(sourceIndex);
                if (!source) return;

                source.selectedIndex = this.selectedIndex;
                source.value = this.value;
                source.dispatchEvent(new Event('input', { bubbles: true }));
                source.dispatchEvent(new Event('change', { bubbles: true }));
                source.blur();
                scheduleSheetRefresh();
            });
            $content.append($fields);
        }

        // 수량/삭제 컨트롤 클릭
        function bindSelectedProductControls($cloneRow, $sourceProductRows, rowIndex) {
            var $sourceRow = $sourceProductRows.eq(rowIndex);
            var $nameCell = $cloneRow.children('td').first();
            var $originalDelete = $sourceRow.find('.delete').first();

            if (!$originalDelete.length) {
                $originalDelete = $sourceRow.find('.option_box_del').first().closest('a');
            }

            // 삭제 가능한 옵션상품
            if ($originalDelete.length) {
                var $deleteButton = $('<button type="button" class="fixed-selected-delete" aria-label="선택상품 삭제"></button>');

                $deleteButton.on('click.fixedSheetDelete', function () {
                    $originalDelete.trigger('click');
                    scheduleSheetRefresh();
                });

                $nameCell.append($deleteButton);
            }

            // 수량
            $cloneRow.find('.fixed-quantity-up, .fixed-quantity-down').on('click.fixedSheetQuantity', function (event) {
                var isUp = $(this).hasClass('fixed-quantity-up');
                var selector = isUp ? '.up' : '.down';
                var $original = $sourceRow.find(selector).first();

                event.preventDefault();
                event.stopPropagation();

                if (!$original.length) return;

                var $trigger = $original.is('a, button') ? $original : $original.closest('a, button');
                ($trigger.length ? $trigger : $original).get(0).click();

                scheduleSheetRefresh();
            });
        }

        function appendSelectedProducts() {
            var $sourceSelected = $('#totalProducts');
            if (!$sourceSelected.length) return false;

            var $productOptions = $('.xans-product-detail .infoArea').first()
                .children('.xans-product-option')
                .find('select');

            var hasProductOptions = $productOptions.length > 0;
            var $sourceProductRows = $sourceSelected.find('tr.option_product, tr.add_product');

            // 옵션 없는 단일상품
            if (!hasProductOptions && !$sourceProductRows.length) {
                $sourceProductRows = $sourceSelected
                    .find('tbody.total-product-group')
                    .first()
                    .children('tr')
                    .not('.option')
                    .first();
            }

            // 옵션 미선택
            if (!$sourceProductRows.length) return false;

            var $selected = $sourceSelected.clone(false).removeAttr('id').addClass('fixed-selected-products');
            var $clonedProductRows;

            if (hasProductOptions) {
                $clonedProductRows = $selected.find('tr.option_product, tr.add_product');
                $selected.find('tr').not('.option_product, .add_product').remove();
            } else {
                $clonedProductRows = $selected
                    .find('tbody.total-product-group')
                    .first()
                    .children('tr')
                    .not('.option')
                    .first();

                $selected.find('tr').not($clonedProductRows).remove();
            }

            $selected.find('tbody').filter(function () {
                return !$(this).children().length;
            }).remove();

            $selected.find('[id]').removeAttr('id');
            $selected.find('[name]').removeAttr('name');
            $selected.find('a').removeAttr('href onclick');
            $selected.find('input').prop('readonly', true);
            $selected.find('.delete, .option_box_del').hide();

            $clonedProductRows.each(function (rowIndex) {
                var $cloneRow = $(this);
                var $nameCell = $cloneRow.children('td').first().addClass('fixed-selected-product-name');
                var $metaCell = $('<td class="fixed-selected-product-meta"></td>');

                var $quantity = $cloneRow.find('.quantity, p').filter(function () {
                    return $(this).children('.quantity_opt').length > 0;
                }).first();

                if (!$quantity.length) {
                    $quantity = $cloneRow.find('.quantity').first();
                }

                if ($quantity.length) {
                    $quantity = $quantity.detach().addClass('quantity fixed-selected-quantity');
                    normalizeQuantityControl($quantity);
                }

                // 가격
                var $price;
                if (!hasProductOptions) {
                    var totalPriceText = $('#totalPrice .total em').first().text().trim();

                    if (totalPriceText) {
                        $price = $('<span class="fixed-single-product-price"></span>').text(totalPriceText);
                    } else {
                        $price = $();
                    }
                } else {
                    $price = $cloneRow.find('.ec-front-product-item-price').first();
                    if (!$price.length) $price = $cloneRow.find('.option_box_price').first().next('span');
                    if (!$price.length) $price = $cloneRow.find('td.right > span').not('.mileage').first();
                }

                // 바텀시트 수량 UI 정규화
                function normalizeQuantityControl($quantity) {
                    if (!$quantity.length) return;

                    var $input = $quantity.find('input').first();
                    if (!$input.length) return;

                    $quantity
                        .empty()
                        .append('<button type="button" class="fixed-quantity-down" aria-label="수량 감소">−</button>')
                        .append($input)
                        .append('<button type="button" class="fixed-quantity-up" aria-label="수량 증가">+</button>');
                }


                $cloneRow.children('td').not($nameCell).remove();

                if ($quantity.length) $metaCell.append($quantity);
                if ($price.length) $metaCell.append($price.detach().addClass('fixed-selected-price'));

                $cloneRow.addClass('fixed-selected-product').append($metaCell);

                bindSelectedProductControls($cloneRow, $sourceProductRows, rowIndex);
            });

            $content.append($selected);

            return true;
        }

        function appendTotalPrice(hasSelectedProducts) {
            var $sheetTotal = $('#totalPrice').clone(false).removeAttr('id').addClass('fixed-total-price');

            if (!hasSelectedProducts) {
                $sheetTotal.find('.total').html('<strong><em>0원</em></strong> (0개)');
            }

            $content.append($sheetTotal);
        }

        function buildActions() {
            $actions.empty().append($fixed.find('.prod-fixed-buttons').children().not('.prod-soldout-button').clone(false));
            $actions.find('[id]').removeAttr('id');
            $actions.find('[onclick]').removeAttr('onclick');
            $actions.find('a').attr('href', '#none');
            $actions.find('.actionCart').on('click', function () { $origin.find('.actionCart').first().trigger('click'); });
            $actions.find('.fixed-btn-fill').on('click', function (event) {
                event.preventDefault();
                var submitButton = $origin.find('.btnSubmit:visible').first().get(0);
                if (submitButton) submitButton.click();
            });
        }

        function buildSheet() {
            $content.empty();
            appendOptionFields();

            var hasSelectedProducts = appendSelectedProducts();
            appendTotalPrice(hasSelectedProducts);
            buildActions();
        }

        function openSheet() {
            buildSheet();
            $layer.addClass('is-open').attr('aria-hidden', 'false');
            $('body').addClass('fixed-option-open');
        }
        function closeSheet() {
            $layer.removeClass('is-open').attr('aria-hidden', 'true');
            $('body').removeClass('fixed-option-open');
        }

        $fixed.off('click.fixedPurchase', '[data-fixed-option-open]').on('click.fixedPurchase', '[data-fixed-option-open]', function (event) {
            event.preventDefault();
            event.stopImmediatePropagation();
            openSheet();
        });
        $layer.off('click.fixedPurchase', '[data-fixed-option-close]').on('click.fixedPurchase', '[data-fixed-option-close]', closeSheet);
        $(document).off('keydown.fixedPurchase').on('keydown.fixedPurchase', function (event) {
            if (event.key === 'Escape') closeSheet();
        });
    }

    /* 상품정보 테이블 행에 라벨 기반 클래스 부여 */
    function initProductInfoTable($) {
        var $rows = $('.xans-product-detaildesign table tr');
        if (!$rows.length) return;

        $rows.each(function () {
            var $row = $(this);
            var label = $row.find('th').first().text().trim();
            if (!label) return;

            var className = PRODUCT_INFO_LABEL_CLASS_MAP[label] || 'prd-' + label.replace(/\s+/g, '');
            $row.addClass(className);
        });
    }

    /* 상품요약정보 칩 변환 */
    //   function initSummaryChips($) {
    //     var $summaryValue = $('.xans-product-detaildesign tr.prd-summary td span').first();
    //     if (!$summaryValue.length) return;

    //     var text = $summaryValue.text().trim();
    //     if (!text) return;

    //     var items = text.split(/[,，]\s*/).filter(function (item) {
    //       return item.length > 0;
    //     });
    //     if (!items.length) return;

    //     var $chipWrap = $('<div class="summary-chip-list"></div>');

    //     items.forEach(function (item, index) {
    //       var colorIndex = (index % SUMMARY_CHIP_COLOR_COUNT) + 1;
    //       $('<span></span>')
    //         .addClass('summary-chip summary-chip--color' + colorIndex)
    //         .text(item)
    //         .appendTo($chipWrap);
    //     });

    //     $summaryValue.replaceWith($chipWrap);
    //   }

    /* 상세 탭 강제 전체 표시 + 클릭 시 스크롤 이동 + 스크롤 시 활성 탭 동기화 */
    function initDetailTabScroll($) {
        var $tabProduct = $('#tabProduct');
        if (!$tabProduct.length) return;

        var $tabLinks = $tabProduct.find('a[href^="#"]');
        var $panels = $();
        var panelToLink = {};

        $tabLinks.each(function () {
            var href = $(this).attr('href');
            var $target = $(href);
            if ($target.length) {
                $panels = $panels.add($target);
                panelToLink[href] = this;
            }
        });

        // 모든 섹션 항상 펼쳐서 표시
        $panels.each(function () {
            this.style.setProperty('display', 'block', 'important');
        });

        var isProgrammaticScroll = false;
        var programmaticScrollTimer = null;

        function setSelectedByLink(link) {
            $tabLinks.closest('li').removeClass('selected');
            $(link).closest('li').addClass('selected');
        }

        // 클릭 시 스크롤 이동
        $tabLinks.off('click.detailTabScroll').on('click.detailTabScroll', function (event) {
            var href = $(this).attr('href');
            var $target = $(href);
            if (!$target.length) return;

            event.preventDefault();

            setSelectedByLink(this);
            isProgrammaticScroll = true;
            window.clearTimeout(programmaticScrollTimer);

            $('html, body').animate(
                { scrollTop: $target.offset().top - DETAIL_TAB_SCROLL_OFFSET },
                400,
                function () {
                    programmaticScrollTimer = window.setTimeout(function () {
                        isProgrammaticScroll = false;
                    }, SCROLL_SPY_ANIMATION_GUARD_MS - 400);
                }
            );

            if (typeof removePagingArea === 'function') {
                removePagingArea(href);
            }
        });

        if (typeof IntersectionObserver === 'undefined') return;

        var scrollSpyObserver = $tabProduct.data('detailTabScrollSpy');
        if (scrollSpyObserver) scrollSpyObserver.disconnect();

        scrollSpyObserver = new IntersectionObserver(
            function (entries) {
                if (isProgrammaticScroll) return;

                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) return;

                    var href = '#' + entry.target.id;
                    var link = panelToLink[href];
                    if (link) setSelectedByLink(link);
                });
            },
            {
                rootMargin: '-' + DETAIL_TAB_SCROLL_OFFSET + 'px 0px -60% 0px',
                threshold: 0
            }
        );
        $tabProduct.data('detailTabScrollSpy', scrollSpyObserver);

        $panels.each(function () {
            scrollSpyObserver.observe(this);
        });
        if (typeof removePagingArea === 'function') {
            removePagingArea('#prdReview');
            removePagingArea('#prdQnA');
        }
    }
})();