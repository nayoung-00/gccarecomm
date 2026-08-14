(function () {
    'use strict';

    var JQUERY_WAIT_INTERVAL = 50;
    var JQUERY_WAIT_MAX_TRY = 100;
    var ALL_VISIBLE_LIMIT = 8;

    waitForJQuery(init);

    function waitForJQuery(callback, tryCount) {
        var currentTry = tryCount || 0;

        if (window.jQuery) {
            callback(window.jQuery);
            return;
        }

        if (currentTry >= JQUERY_WAIT_MAX_TRY) {
            console.error('[MAIN] jQuery 로드 타임아웃 - 메인 페이지 기능 비활성화');
            return;
        }

        window.setTimeout(function () {
            waitForJQuery(callback, currentTry + 1);
        }, JQUERY_WAIT_INTERVAL);
    }

    function init($) {
        $(function () {
            initVisualSwiper($);
            initMainProd($);
        });
    }

    /* =====================================================
       비주얼 스와이퍼
    ===================================================== */
    function initVisualSwiper($) {
        var $visualSwiper = $('.visual-swiper');
        if (!$visualSwiper.length) return;

        var visualArrowSvg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M3.96359 9.15583C4.15885 9.35103 4.47537 9.35107 4.67062 9.15583L8.0378 5.78864C8.13675 5.68948 8.18491 5.55911 8.18331 5.42926C8.1853 5.29882 8.13729 5.1675 8.0378 5.06794L4.67062 1.70075C4.47545 1.50558 4.15887 1.50577 3.96359 1.70075C3.76832 1.89601 3.76833 2.21252 3.96359 2.40778L6.98409 5.42829L3.96359 8.4488C3.76832 8.64406 3.76832 8.96056 3.96359 9.15583Z" fill="white" />
            </svg>
        `;

        new Swiper($visualSwiper[0], {
            slidesPerView: 1,
            spaceBetween: 16,
            speed: 500,
            pagination: {
                el: '.visual-pagination',
                type: 'progressbar'
            }
        });

        $('.visual-link').append(visualArrowSvg);
    }

    /* =====================================================
       메인 상품 탭
    ===================================================== */
    // function initMainProd($) {
    //     var $mainProd = $('.main-prod');
    //     if (!$mainProd.length) return;

    //     var $tabs = $mainProd.find('.product-tab');
    //     var $panels = $mainProd.find('.tabcontent');
    //     var $productCount = $mainProd.find('.prod-tab-sort .num');
    //     var $allMoreButton = $mainProd.find('.btn-common-more');
    //     var $allMoreCurrentPage = $allMoreButton.find('.all-more-current-page');
    //     var $allMoreTotalPage = $allMoreButton.find('.all-more-total-page');
    //     var $allProductList = $mainProd.find('.main-prod__all-list');
    //     var currentCategory = 'all';

    //     var $tabProdSwiper = $mainProd.find('.tab-prod-swiper');
    //     if ($tabProdSwiper.length) {
    //         new Swiper($tabProdSwiper[0], {
    //             slidesPerView: 'auto',
    //             freeMode: true,
    //             spaceBetween: 0,
    //             speed: 500,
    //             slidesOffsetBefore: 16
    //         });
    //     }

    //     function getProductKey($product, fallbackIndex) {
    //         var dataProductNo = $product.attr('data-product-no') || $product.data('product-no');
    //         if (dataProductNo) return `product-${dataProductNo}`;

    //         var productId = $product.attr('id') || '';
    //         var idMatch = productId.match(/anchorBoxId[_-]?(\d+)/i);
    //         if (idMatch) return `product-${idMatch[1]}`;

    //         var productLink = $product.find('a[href*="product_no="]').first().attr('href') || '';
    //         var linkMatch = productLink.match(/[?&]product_no=(\d+)/);
    //         if (linkMatch) return `product-${linkMatch[1]}`;

    //         return `unknown-${fallbackIndex}`;
    //     }

    //     function buildAllProductList() {
    //         var productKeys = new Set();
    //         var $allProducts = $();

    //         $panels.find('.prdList > li').each(function (index) {
    //             var $product = $(this);
    //             var productKey = getProductKey($product, index);
    //             if (productKeys.has(productKey)) return;

    //             productKeys.add(productKey);
    //             var $productClone = $product.clone(false, false).removeAttr('id');

    //             $productClone.toggleClass('is-all-hidden', $allProducts.length >= ALL_VISIBLE_LIMIT);
    //             $allProducts.push($productClone[0]);
    //         });

    //         $allProductList.empty().append($allProducts);
    //         return $allProducts.length;
    //     }

    //     function getPanelProductCount($panel) {
    //         return $panel.find('.prdList > li').length;
    //     }

    //     function updateProductCount() {
    //         var allProductCount = buildAllProductList();

    //         var productCount = currentCategory === 'all'
    //             ? allProductCount
    //             : getPanelProductCount($panels.filter('.is-active'));

    //         $productCount.text(productCount);

    //         $allMoreCurrentPage.text(1);
    //         $allMoreTotalPage.text(
    //             Math.max(1, Math.ceil(allProductCount / ALL_VISIBLE_LIMIT))
    //         );

    //         $allMoreButton.prop(
    //             'hidden',
    //             allProductCount <= ALL_VISIBLE_LIMIT
    //         );
    //     }

    //     function changeProductTab(category) {
    //         var isAllView = category === 'all';
    //         currentCategory = category;

    //         $tabs.removeClass('is-active');
    //         $tabs.filter(`[data-category="${category}"]`).addClass('is-active');
    //         $mainProd.toggleClass('is-view-all is-all', isAllView).removeClass('is-all-expanded');

    //         if (isAllView) {
    //             $panels.addClass('is-active');
    //         } else {
    //             $panels.removeClass('is-active');
    //             $panels.filter(`[data-panel="${category}"]`).addClass('is-active');
    //         }

    //         updateProductCount();
    //     }

    //     $tabs.on('click', function () {
    //         changeProductTab($(this).data('category'));
    //     });

    //     $allMoreButton.on('click', function () {
    //         $mainProd.addClass('is-all-expanded');
    //         $(this).prop('hidden', true);
    //     });

    //     var productListObserver = new MutationObserver(function () {
    //         updateProductCount();
    //     });

    //     $panels.find('.prdList').each(function () {
    //         productListObserver.observe(this, { childList: true });
    //     });

    //     changeProductTab('all');
    // }
})();