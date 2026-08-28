(function () {
    'use strict';

    var JQUERY_WAIT_INTERVAL = 50;
    var JQUERY_WAIT_MAX_TRY = 100;
    var PRICE_LI_DEBOUNCE = 100;

    
    var ALPHA_REVIEW_API_URL ='https://review-widget.alphwidget.com/v2/api-widget';
    var ALPHA_REVIEW_WIDGET_CODE = '5f91819b';  


    waitForJQuery(init);

    function waitForJQuery(callback, tryCount) {
        var currentTry = tryCount || 0;

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
        var timer = null;

        function applySoldoutOverlay() {
            document.querySelectorAll('.prdList__item').forEach(function (item) {
                var thumbnail = item.querySelector('.thumbnail');
                if (!thumbnail) return;

                var soldoutIcon = thumbnail.querySelector('.icon img[alt="품절"], .badge--onThumb img[alt="품절"]');
                var hasSoldout = !!soldoutIcon;
                item.classList.toggle('is-soldout', hasSoldout);

                if (!hasSoldout) return;
                soldoutIcon.classList.add('soldout-source-icon');

                if (!thumbnail.querySelector('.soldout-thumb-overlay')) {
                    var overlay = document.createElement('span');
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
            
            var thumbnail = item.querySelector('.thumbnail');
            var description = item.querySelector('.description');
            var iconBox = description ? description.querySelector('.icon') : null;
            var saleBox = item.querySelector('.sale_box');
            var specList = description ? description.querySelector('ul.spec') : null;

            // 배지(아이콘)를 썸네일 위로 이동
            if (iconBox && thumbnail) {
                iconBox.classList.add('badge--onThumb');
                thumbnail.appendChild(iconBox);
            }

            // 할인율을 판매가 앞으로 이동
            if (saleBox && specList) {
                var priceLi = Array.prototype.find.call(
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
                    var titleEl = li.querySelector('.title');
                    if (titleEl && titleEl.textContent.includes('사용후기')) {
                        li.remove();
                    }
                });
            }

            // 별점 영역 삽입
            var nameEl = description ? description.querySelector('.name') : null;
            if (nameEl && description && !description.querySelector('.starRating')) {
                var starWrap = document.createElement('div');

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

            item.dataset.productLayoutApplied = 'true';
        });
    }

    /* =====================================================
    더보기 상품 동적 처리
    ===================================================== */
    function initDynamicProductItems() {

        var timer = null;
    
        var productList = document.querySelector('.prdList');
    
        if (!productList) return;
    
        var previousCount =
            document.querySelectorAll('.prdList__item').length;
    
        var observer = new MutationObserver(function () {
    
            window.clearTimeout(timer);
    
            timer = window.setTimeout(function () {
    
                var currentCount =
                    document.querySelectorAll('.prdList__item').length;
    
                if (currentCount <= previousCount) {
                    return;
                }
    
                previousCount = currentCount;
    
                initProductItemLayout();
                initProductReviews();
    
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
        var priceTimer = null;

        function tagPriceLi() {
            $('.prdList__item ul.spec > li').each(function () {
                var $li = $(this);
                var text = $li.text().replace(/\s+/g, '');

                if (text.indexOf('판매가') > -1) {
                    $li.addClass('price-li');
                }
            });
        }

        function scheduleRun() {
            clearTimeout(priceTimer);
            priceTimer = setTimeout(tagPriceLi, PRICE_LI_DEBOUNCE);
        }

        tagPriceLi();

        var observer = new MutationObserver(scheduleRun);
        observer.observe(document.body, { childList: true, subtree: true });
    }

    /* =====================================================
       정렬 셀렉트 첫 옵션 라벨 변경
    ===================================================== */
    function initSortSelectLabel($) {
        $('#selArray option:first').text('추천순');
    }

    // 메인 상품 조회
    function initProductReviews() {
        var items = document.querySelectorAll(
            '.prdList__item'
        );
    
        items.forEach(function (item) {

            if (item.dataset.alphaReviewRequested === 'true') {
                return;
            }
            
            var productNo = getProductNo(item);
    
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
        var productLi = item.closest('li[id^="anchorBoxId_"]');
    
        if (!productLi) return null;
    
        return productLi.id.replace('anchorBoxId_', '');
    }

    function fetchAlphaReview(productNo) {
        var url =
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
    
        var starRating = item.querySelector('.starRating');
    
        if (!starRating) return;
    
        var scoreEl =
            starRating.querySelector('.starRating__score');
    
        var countEl =
            starRating.querySelector('.starRating__count');
    
        if (!scoreEl || !countEl) return;
    
        scoreEl.textContent =
            data.review_rating.toFixed(1);
    
        countEl.textContent =
            '리뷰 ' + data.review_count + '건';
    
        starRating.hidden = false;
    }

})();
