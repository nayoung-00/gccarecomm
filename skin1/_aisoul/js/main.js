(function () {
    'use strict';

    const JQUERY_WAIT_INTERVAL = 50;
    const JQUERY_WAIT_MAX_TRY = 100;
    // var ALL_VISIBLE_LIMIT = 8;
    waitForJQuery(init);

    function waitForJQuery(callback, tryCount) {
        const currentTry = tryCount || 0;

        if (window.jQuery) {
            callback(window.jQuery);
            return;
        }

        if (currentTry >= JQUERY_WAIT_MAX_TRY) {
            console.error('메인 페이지 기능 비활성화');
            return;
        }

        window.setTimeout(function () {
            waitForJQuery(callback, currentTry + 1);
        }, JQUERY_WAIT_INTERVAL);
    }

    function init($) {
        $(function () {
            initVisualSwiper($);
            // initMainProd($);
        });
    }

    /* =====================================================
       비주얼 스와이퍼
    ===================================================== */
    function initVisualSwiper($) {
        const $visualSwiper = $('.visual-swiper');
        if (!$visualSwiper.length) return;

        const visualArrowSvg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M4.33296 11.9893C4.52822 12.1846 4.84571 12.1846 5.04097 11.9893L9.66695 7.36332C9.76696 7.26331 9.81489 7.1311 9.81245 7.00004C9.81492 6.86894 9.76698 6.73679 9.66695 6.63676L5.04097 2.01078C4.84571 1.81552 4.52822 1.81552 4.33296 2.01078C4.13813 2.20603 4.13795 2.52267 4.33296 2.71781L8.61519 7.00004L4.33296 11.2823C4.13798 11.4774 4.1381 11.7941 4.33296 11.9893Z" fill="white"/>
            </svg>
        `;

        new Swiper($visualSwiper[0], {
            slidesPerView: 1,
            spaceBetween: 16,
            speed: 500,
            autoplay: {
                delay: 3000, 
            },
            pagination: {
                el: '.visual-pagination',
                type: 'fraction'
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