(function () {
    'use strict';

    const JQUERY_WAIT_INTERVAL = 50;
    const JQUERY_WAIT_MAX_TRY = 100;
    const PRICE_LI_DEBOUNCE = 100;

    // 상품 목록 캐시백 금액 — 퍼블리싱 임시값
    // const PRODUCT_CASHBACK_AMOUNT = 4000;

    
    const ALPHA_REVIEW_API_URL ='https://review-widget.alphwidget.com/v2/api-widget';
    const ALPHA_REVIEW_WIDGET_CODE = '5f91819b'; 

    // const CAFE24_PRODUCT_CONFIG_URL = '/calendar/app/config.json';
    // const CAFE24_PRODUCT_CODE_FIELDS = 'product_no,product_code';

    // let cafe24ProductSdk = null;
    // let cafe24ProductSdkPromise = null;
    // const productCodeMap = {};
    // const productCodeRequested = {};
    // let productCodeFetchPromise = null;

    const GC_PRODUCT_NOTICE_BASE_URL = 'https://stg-cafe24.howcare.co.kr/api/products';
    const PRODUCT_NOTICE_EMPTY_CODES = [
        'PRODUCT_INFORMATION_TYPE_MISSING',
        'PRODUCT_INFORMATION_INVALID'
    ];
    const productCashbackCache = {};
    const productCashbackRequested = {};

    // 소비자가 li 마지막에 붙는 가격 라벨
    const PRICE_LABEL_CLASS = 'price-label';
    // const PRICE_LABEL_MEMBER = '어떠케어 회원 특별가';


    waitForJQuery(init);

    function waitForJQuery(callback, tryCount) {
        const currentTry = tryCount || 0;

        if (window.jQuery) {
            callback(window.jQuery);
            return;
        }

        if (currentTry >= JQUERY_WAIT_MAX_TRY) {
            console.error('[PRODUCT_LIST] jQuery 로드 타임아웃 - 상품 리스트 기능 비활성화');
            return;
        }

        window.setTimeout(function () {
            waitForJQuery(callback, currentTry + 1);
        }, JQUERY_WAIT_INTERVAL);
    }

    function init($) {
        $(function () {
            initProductItemLayout();
            initProductReviews();
            initProductCashbacks();
            initDynamicProductItems();
            initSoldoutOverlay();
            initPriceLiTagging($);
            initSortSelectLabel($);
        });
    }

    /* =====================================================
       품절 상품 썸네일 오버레이 (카페24 품절 아이콘 기준)
    ===================================================== */
    function initSoldoutOverlay() {
        let timer = null;

        function applySoldoutOverlay() {
            document.querySelectorAll('.prdList__item').forEach(function (item) {
                const thumbnail = item.querySelector('.thumbnail');
                if (!thumbnail) return;

                const soldoutIcon = thumbnail.querySelector('.icon img[alt="품절"], .badge--onThumb img[alt="품절"]');
                const hasSoldout = !!soldoutIcon;
                item.classList.toggle('is-soldout', hasSoldout);

                if (!hasSoldout) return;
                soldoutIcon.classList.add('soldout-source-icon');

                if (!thumbnail.querySelector('.soldout-thumb-overlay')) {
                    const overlay = document.createElement('span');
                    overlay.className = 'soldout-thumb-overlay';
                    overlay.textContent = '품절';
                    thumbnail.appendChild(overlay);
                }
            });
        }

        function scheduleApply() {
            window.clearTimeout(timer);
            timer = window.setTimeout(applySoldoutOverlay, 100);
        }

        applySoldoutOverlay();
        new MutationObserver(scheduleApply).observe(document.body, { childList: true, subtree: true });
    }

    /* =====================================================
       상품 아이템 배지/할인율/후기/별점 정리
    ===================================================== */
    function initProductItemLayout() {
        document.querySelectorAll('.prdList__item').forEach(function (item) {

             // 이미 처리한 기존 상품은 다시 건드리지 않음
            if (item.dataset.productLayoutApplied === 'true') {
                return;
            }
        
            const thumbnail = item.querySelector('.thumbnail');
            const description = item.querySelector('.description');
            const iconBox = description ? description.querySelector('.icon') : null;
            const saleBox = item.querySelector('.sale_box');
            const specList = description ? description.querySelector('ul.spec') : null;

            // 배지(아이콘)를 썸네일 위로 이동
            if (iconBox && thumbnail) {
                iconBox.classList.add('badge--onThumb');
                thumbnail.appendChild(iconBox);
            }

            // 할인율을 판매가 앞으로 이동
            if (saleBox && specList) {
                const priceLi = Array.prototype.find.call(
                    specList.querySelectorAll('li'),
                    function (li) {
                        return li.textContent.includes('판매가');
                    }
                );
                if (priceLi) priceLi.prepend(saleBox);
            }

            // 사용후기 항목 제거
            if (specList) {
                specList.querySelectorAll('li').forEach(function (li) {
                    const titleEl = li.querySelector('.title');
                    if (titleEl && titleEl.textContent.includes('사용후기')) {
                        li.remove();
                    }
                });
            }

            // 별점 영역 삽입
            const nameEl = description ? description.querySelector('.name') : null;
            if (nameEl && description && !description.querySelector('.starRating')) {
                const starWrap = document.createElement('div');

                starWrap.className = 'starRating';
                starWrap.hidden = true;
                starWrap.innerHTML = '<span class="starRating__scoreWrap">' +
                                        '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7.48991 1.09041L9.07991 4.30041C9.11607 4.38188 9.17296 4.45246 9.2449 4.50509C9.31684 4.55773 9.40131 4.59059 9.48991 4.60041L12.9999 5.12041C13.1015 5.13347 13.1974 5.17518 13.2762 5.24066C13.355 5.30615 13.4135 5.3927 13.445 5.49022C13.4764 5.58774 13.4795 5.69219 13.4538 5.79139C13.4281 5.89058 13.3748 5.98042 13.2999 6.05041L10.7699 8.56041C10.7053 8.62074 10.6569 8.69625 10.6289 8.78008C10.601 8.86391 10.5944 8.9534 10.6099 9.04041L11.2199 12.5704C11.2376 12.6718 11.2264 12.7762 11.1877 12.8716C11.149 12.967 11.0843 13.0496 11.0009 13.11C10.9175 13.1705 10.8189 13.2063 10.7162 13.2134C10.6135 13.2206 10.5108 13.1987 10.4199 13.1504L7.25991 11.4804C7.17899 11.4407 7.09005 11.42 6.99991 11.42C6.90977 11.42 6.82083 11.4407 6.73991 11.4804L3.57991 13.1504C3.489 13.1987 3.38635 13.2206 3.28364 13.2134C3.18093 13.2063 3.08228 13.1705 2.99893 13.11C2.91557 13.0496 2.85085 12.967 2.81213 12.8716C2.77341 12.7762 2.76225 12.6718 2.77991 12.5704L3.38991 9.00041C3.40537 8.9134 3.39883 8.82391 3.37089 8.74008C3.34294 8.65625 3.29448 8.58074 3.22991 8.52041L0.669911 6.05041C0.594174 5.9785 0.540911 5.88618 0.516575 5.78462C0.492239 5.68306 0.497875 5.57663 0.532798 5.47821C0.567722 5.37979 0.630435 5.2936 0.713342 5.2301C0.796248 5.16659 0.895791 5.12849 0.999911 5.12041L4.50991 4.60041C4.59851 4.59059 4.68299 4.55773 4.75492 4.50509C4.82686 4.45246 4.88375 4.38188 4.91991 4.30041L6.50991 1.09041C6.55321 0.996916 6.62235 0.917763 6.70918 0.862291C6.796 0.806819 6.89688 0.777344 6.99991 0.777344C7.10294 0.777344 7.20382 0.806819 7.29065 0.862291C7.37747 0.917763 7.44661 0.996916 7.48991 1.09041Z" fill="#0AC262"/></svg>' +
                                        '</svg>' +
                                        '<strong class="starRating__score"></strong>' +
                                    '</span>' +
                                    '<span class="starRating__count"></span>';
                nameEl.before(starWrap);
            }

            // if (description) {
            //     renderProductCashback(description);
            // }

            item.dataset.productLayoutApplied = 'true';
        });


    }

    /* =====================================================
       상품 description 마지막 캐시백
    ===================================================== */

    function parseNaverPayPaybackAmount(value) {
        if (value == null) {
            return 0;
        }

        const str = String(value).trim();
        if (!str) {
            return 0;
        }

        if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(str)) {
            return 0;
        }

        const parsed = parseInt(str.replace(/,/g, ''), 10);
        if (!parsed || parsed <= 0) {
            return 0;
        }

        return parsed;
    }

    function clearProductCashback(description) {
        const existing = description.querySelector('.productCashback');
        if (existing) {
            existing.remove();
        }
    }

    function renderProductCashback(description, amount) {
        const parsedAmount = parseNaverPayPaybackAmount(amount);

        if (!parsedAmount) {
            clearProductCashback(description);
            return;
        }
        const formattedAmount = parsedAmount.toLocaleString('ko-KR');
        const existing = description.querySelector('.productCashback');

        if(existing){
            const amountEl = existing.querySelector('.productCashbackAmount');
            if(amountEl){
                amountEl.textContent = formattedAmount;
            }

            return;

        }

        description.insertAdjacentHTML(
            'beforeend',
            '<div class="productCashback">' +
                '<svg class="productCashbackIcon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">' +
                    '<path d="M2.50098 4V10C2.50098 11.1 4.50098 12 7.00098 12C9.50098 12 11.501 11.1 11.501 10V4" fill="#92E7BB"></path>' +
                    '<path d="M2.50098 4V10C2.50098 11.1 4.50098 12 7.00098 12C9.50098 12 11.501 11.1 11.501 10V4" stroke="#0AC262" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"></path>' +
                    '<path d="M11.501 7C11.501 8.1 9.50098 9 7.00098 9C4.50098 9 2.50098 8.1 2.50098 7" stroke="#0AC262" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"></path>' +
                    '<path d="M7.00098 5.99805C9.48626 5.99805 11.501 5.10262 11.501 3.99805C11.501 2.89348 9.48626 1.99805 7.00098 1.99805C4.5157 1.99805 2.50098 2.89348 2.50098 3.99805C2.50098 5.10262 4.5157 5.99805 7.00098 5.99805Z" fill="#92E7BB" stroke="#0AC262" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"></path>' +
                '</svg>' +
                '<p class="productCashbackText">' +
                    '리워드 적용 시 <span class="productCashbackAmount">' +
                        formattedAmount +
                    '</span>원' +
                '</p>' +
            '</div>'
        );
    }

    /* =====================================================
    더보기 상품 동적 처리
    ===================================================== */
    function initDynamicProductItems() {

        let timer = null;
        const productList = document.querySelector('.prdList');
        if (!productList) return;
        let previousCount = document.querySelectorAll('.prdList__item').length;
        const observer = new MutationObserver(function () {
            window.clearTimeout(timer);
            timer = window.setTimeout(function () {
    
                const currentCount =
                    document.querySelectorAll('.prdList__item').length;
                if (currentCount <= previousCount) {
                    return;
                }
                previousCount = currentCount;
                initProductItemLayout();
                initProductReviews();
                initProductCashbacks();
            }, 100);
        });
    
        observer.observe(productList, {
            childList: true,
            subtree: true
        });
    }




    /* =====================================================
       판매가 li 클래스명 추가 (동적 DOM 대응)
    ===================================================== */
    function initPriceLiTagging($) {
        let priceTimer = null;

        // spec 항목 title 텍스트 → 추가할 클래스 (li 순서는 상품마다 달라서 title로 매칭)
        const SPEC_TITLE_CLASS = {
            '소비자가': 'consumer-li',
            '판매가': 'price-li',
            '최적할인가': 'discount-li'
        };

        function tagPriceLi() {
            $('.prdList__item ul.spec > li').each(function () {
                const $li = $(this);
                const title = getSpecTitle(this);

                if (SPEC_TITLE_CLASS[title]) {
                    $li.addClass(SPEC_TITLE_CLASS[title]);
                }
            });
        }

        function scheduleRun() {
            clearTimeout(priceTimer);
            priceTimer = setTimeout(tagPriceLi, PRICE_LI_DEBOUNCE);
        }

        tagPriceLi();

        const observer = new MutationObserver(scheduleRun);
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // spec li의 title 텍스트 (공백·콜론 제거, 직접 붙인 price-label은 제외)
    function getSpecTitle(li) {
        const titleEl = li.querySelector(':scope > .title') || li;
        let text = '';

        titleEl.childNodes.forEach(function (node) {
            if (node.nodeType === 1 && node.classList.contains(PRICE_LABEL_CLASS)) return;
            text += node.textContent;
        });

        return text.replace(/[\s:]/g, '');
    }

    function findSpecLi(specList, title) {
        return Array.prototype.find.call(specList.children, function (li) {
            return getSpecTitle(li) === title;
        }) || null;
    }

    /* =====================================================
       소비자가 li 가격 라벨
       - 소비자가 li의 마지막 자식(가격 span 뒤 형제)으로 추가
       - 리워드(캐시백) 상품만 어떠케어 회원 특별가, 리워드가 아니면 라벨 제거
    ===================================================== */
    function renderPriceLabel(item, isReward) {
        const specList = item.querySelector('ul.spec');
        if (!specList) return;

        const consumerLi = findSpecLi(specList, '소비자가');
        if (!consumerLi) return;

        let labelEl = consumerLi.querySelector(':scope > .' + PRICE_LABEL_CLASS);
        if (!isReward) {
            if (labelEl) labelEl.remove();
            return;
        }

        if (!labelEl) {
            labelEl = document.createElement('span');
            labelEl.className = PRICE_LABEL_CLASS;
            consumerLi.appendChild(labelEl);
        }

        // labelEl.textContent = PRICE_LABEL_MEMBER;
    }

    /* =====================================================
       정렬 셀렉트 첫 옵션 라벨 변경
    ===================================================== */
    function initSortSelectLabel($) {
        $('#selArray option:first').text('추천순');
    }

    // 메인 상품 조회
    function initProductReviews() {
        const items = document.querySelectorAll(
            '.prdList__item'
        );
    
        items.forEach(function (item) {

            if (item.dataset.alphaReviewRequested === 'true') {
                return;
            }
            
            const productNo = getProductNo(item);
    
            if (!productNo) return;
            item.dataset.alphaReviewRequested = 'true';
    
            fetchAlphaReview(productNo)
                .then(function (data) {
                    renderProductReview(item, data);
                })
                .catch(function (error) {
                    console.error(
                        '[ALPHA REVIEW]',
                        productNo,
                        error
                    );
                });
        });
    }

    // 상품번호
    function getProductNo(item) {
        const productLi = item.closest('li[id^="anchorBoxId_"]');
    
        if (!productLi) return null;
    
        return productLi.id.replace('anchorBoxId_', '');
    }


    /* =====================================================
       GC information-notice → 상품별 캐시백
    ===================================================== */
    function fetchProductCashbackNotice(productNo) {
        const requestUrl =
            GC_PRODUCT_NOTICE_BASE_URL + '/' +
            encodeURIComponent(productNo) + '/information-notice';

        return fetch(requestUrl)
            .then(function (res) {
                return res.text().then(function (text) {
                    let body = text;

                    try {
                        body = text ? JSON.parse(text) : null;
                    } catch (parseError) {
                        // JSON이 아니면 원문 문자열 유지
                    }

                    if (res.ok) {
                        return {
                            amount: parseNaverPayPaybackAmount(
                                body ? body.naverPayPaybackAmount : null
                            )
                        };
                    }

                    if (
                        res.status === 422 &&
                        body &&
                        typeof body === 'object' &&
                        PRODUCT_NOTICE_EMPTY_CODES.indexOf(body.code) !== -1
                    ) {
                        console.warn('[GC CASHBACK] no product notice:', {
                            productNo: productNo,
                            code: body.code,
                            message: body.message
                        });
                        return { amount: 0 };
                    }

                    throw new Error(
                        'unexpected response: ' + res.status
                    );
                });
            });
    }

    function applyCashbackToItem(item, amount) {
        // 리워드 여부가 확정된 시점에 가격 라벨도 함께 반영 - 261029 수정
        // renderPriceLabel(item, !!parseNaverPayPaybackAmount(amount));

        const description = item.querySelector('.description');
        if (!description) {
            return;
        }
        renderProductCashback(description, amount);
    }

    function applyCashbackForProductNo(productNo, amount) {
        document.querySelectorAll('.prdList__item').forEach(function (item) {
            if (getProductNo(item) === productNo) {
                applyCashbackToItem(item, amount);
            }
        });
    }

    function initProductCashbacks() {
        document.querySelectorAll('.prdList__item').forEach(function (item) {
            const productNo = getProductNo(item);
            if (!productNo) {
                return;
            }

            if (Object.prototype.hasOwnProperty.call(productCashbackCache, productNo)) {
                applyCashbackToItem(item, productCashbackCache[productNo].amount);
                return;
            }

            if (productCashbackRequested[productNo]) {
                return;
            }

            productCashbackRequested[productNo] = true;

            fetchProductCashbackNotice(productNo)
                .then(function (result) {
                    productCashbackCache[productNo] = {
                        amount: result.amount || 0
                    };
                    delete productCashbackRequested[productNo];
                    applyCashbackForProductNo(productNo, result.amount);
                })
                .catch(function (error) {
                    delete productCashbackRequested[productNo];
                    console.warn('[GC CASHBACK] request failed:', productNo, error);

                    // 리워드 여부를 알 수 없으면 회원 특별가 라벨을 붙이지 않는다.
                    document.querySelectorAll('.prdList__item').forEach(function (target) {
                        if (getProductNo(target) === productNo) {
                            renderPriceLabel(target, false);
                        }
                    });
                });
        });
    }

    function fetchAlphaReview(productNo) {
        const url =
            ALPHA_REVIEW_API_URL +
            '?page=1' +
            '&page_size=10' +
            '&widget_code=' + ALPHA_REVIEW_WIDGET_CODE +
            '&product_no=' + encodeURIComponent(productNo) +
            '&device=w';
    
        return fetch(url).then(function (response) {
            if (!response.ok) {
                throw new Error(
                    'HTTP ' + response.status
                );
            }
    
            return response.json();
        });
    }

    function renderProductReview(item, data) {
        if (!data || data.code === 'RESULT_EMPTY_HIDE') {
            return;
        }
    
        if (
            typeof data.review_rating !== 'number' ||
            typeof data.review_count !== 'number'
        ) {
            return;
        }
    
        const starRating = item.querySelector('.starRating');
    
        if (!starRating) return;
    
        const scoreEl =
            starRating.querySelector('.starRating__score');
    
        const countEl =
            starRating.querySelector('.starRating__count');
    
        if (!scoreEl || !countEl) return;
    
        scoreEl.textContent =
            data.review_rating.toFixed(1);
    
        countEl.textContent =
            '리뷰 ' + data.review_count + '건';
    
        starRating.hidden = false;
    }

})();

// 상품목록 깜빡임 방지
$(function () {
    const $productArea =
        $('.normalpackage_box');

    const $productItems =
        $productArea.find('.prdList').first().children('li');

    if (!$productArea.length || !$productItems.length) {
        $productArea.removeClass('is-product-loading');
        return;
    }

    $productItems.slice(0, 4).each(function () {
        if (
            $(this)
                .children('.product-card-skeleton')
                .length
        ) {
            return;
        }

        $(this).append(
            '<div class="product-card-skeleton" aria-hidden="true">' +
                '<div class="product-card-skeleton__thumb"></div>' +
                '<div class="product-card-skeleton__text product-card-skeleton__text--first"></div>' +
                '<div class="product-card-skeleton__text product-card-skeleton__text--second"></div>' +
                '<div class="product-card-skeleton__price"></div>' +
            '</div>'
        );
    });

    function finishProductSkeleton() {
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                $productArea.removeClass(
                    'is-product-loading'
                );

                $productArea
                    .find('.product-card-skeleton')
                    .remove();
            });
        });
    }

    if (document.readyState === 'complete') {
        finishProductSkeleton();
    } else {
        $(window).one(
            'load.productSkeleton',
            finishProductSkeleton
        );
    }
});