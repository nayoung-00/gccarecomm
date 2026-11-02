$(function () {
    if ($(".menuCategory > li").length == 0) {
        $(".ec-base-tab.typeMenu").hide();	//중분류 없으면 영역 숨김 - 정환
    } else {
        $(".menuCategory li").each(function (i) {
            var ulElChk = $(this).find('ul').length;
            if (ulElChk == 0) {
                $(this).find('.iconWrap').remove();
            }
        });

        var domWidth = $(document).width();
        if (domWidth < 1024) {
            if ($(".display_tablet_only .menuCategory > li").length == 0) {
                $(".ec-base-tab.typeMenu").hide();	//Mobile에서 마지막분류 없으면 영역 숨김 - 정환
            }

            $(".menuCategory .iconWrap").on('click', function (e) {
                var target = $(this).closest('li');
                var ulEl = returnTarget(target);
                var ulElchk = ulEl.hasClass('active');

                if (ulElchk) {
                    var classChk = $(this).closest('ul').hasClass('active');
                    if (!classChk) { heightCheck(ulEl, "out"); }
                    mouseEvent(target, "out");

                    target.find('ul').removeClass('active');
                } else {
                    heightCheck(ulEl, "hover");
                    mouseEvent(target, "hover");
                }
                target.siblings('li').find('ul').removeClass('active');

            });
        } else {
            $(".menuCategory li").hover(function () {
                mouseEvent($(this), "hover");
            }, function () {
                mouseEvent($(this), "out");
            });
        }
    };

    function mouseEvent(_this, str) {
        var target = returnTarget(_this);
        str == "hover" ? target.addClass('active') : target.removeClass('active');
    }

    function returnTarget(_this) {
        var target = _this.children('ul');
        var ulElChk = target.length;
        if (ulElChk == 0) { target = _this.children('.button').children('ul') }

        return target;
    }

    function heightCheck(ulEl, str) {
        if (str == "out") {
            $('.menuCategory.menu').css({ "height": "" });
        } else {
            var height = ulEl.outerHeight(true);
            var menuHeight = $('.menuCategory .menu li').outerHeight(true);
            var cul = (menuHeight + height) + 10;

            $('.menuCategory.menu').css({ "height": cul });
        }
    };

});


// $(function(){
//     var $selector = $('.health-category-selector');
//     var $button = $selector.find('.health-category-selector__button');
//     var $current = $selector.find('.health-category-selector__current');
//     var $sheet = $('#healthCategorySheet');
//     var $dim = $('.health-category-selector__dim');

//     if (!$selector.length || !$sheet.length) return;

//     var rootCategoryUrl = '/product/list.html?cate_no=47';

//     function cateNoFromUrl(url) {
//         var targetUrl = url || '';
//         var queryMatch = targetUrl.match(/[?&]cate_no=([^&/]+)/);
//         var pathMatch = targetUrl.match(/\/(\d+)\/?(?:[?#].*)?$/);
//         return queryMatch ? queryMatch[1] : (pathMatch ? pathMatch[1] : '');
//     }

//     var currentCateNo = cateNoFromUrl(window.location.href) || '47';

//     function makeCategoryMenu($sourceMenu) {
//         var $menu = $('<nav/>', { 'class': 'health-category-selector__menu', 'aria-label': '카테고리' });
//         var seenLinks = {};

//         $('<a/>', { href: rootCategoryUrl, text: '전체' })
//             .toggleClass('is-selected', currentCateNo === '47')
//             .appendTo($menu);
//         seenLinks[rootCategoryUrl] = true;

//         $sourceMenu.find('a[href]').each(function(){
//             var $link = $(this);
//             var href = $link.attr('href');
//             var name = $.trim($link.clone().children().remove().end().text());

//             if (!href || href === '#none' || !name || seenLinks[href]) return;
//             seenLinks[href] = true;

//             $('<a/>', { href: href, text: name })
//                 .toggleClass('is-selected', cateNoFromUrl(href) === currentCateNo)
//                 .appendTo($menu);
//         });

//         $sheet.find('.health-category-selector__menu').remove();
//         // $sheet.append($('<p/>', { 'class': 'health-category-selector__sheet-title', text: '전체' }));
//         $sheet.append($menu);

//         var $selected = $menu.find('.is-selected').first();
//         if ($selected.length) $current.removeClass('is-loading').removeAttr('aria-busy').text($selected.text());
//     }

//     $current.addClass('is-loading').attr('aria-busy', 'true').text('카테고리 불러오는 중');
//     makeCategoryMenu($sheet.find('.display_tablet_only .menuCategory').first());

//     $.get(rootCategoryUrl).done(function(response){
//         var $response = $('<div/>').append($.parseHTML(response, document, false));
//         var $rootMenu = $response.find('#healthCategorySheet .display_tablet_only .menuCategory').first();

//         if ($rootMenu.length) {
//             makeCategoryMenu($rootMenu);
//         } else {
//             makeCategoryMenu($sheet.find('.display_tablet_only .menuCategory').first());
//         }
//     }).fail(function(){
//         makeCategoryMenu($sheet.find('.display_tablet_only .menuCategory').first());
//         $current.removeClass('is-loading').removeAttr('aria-busy');
//     });

//     function closeCategorySheet() {
//         $sheet.prop('hidden', true);
//         $dim.prop('hidden', true);
//         $button.attr('aria-expanded', 'false');
//         $('body').removeClass('health-category-sheet-open');
//     }

//     $button.on('click', function(){
//         $sheet.prop('hidden', false);
//         $dim.prop('hidden', false);
//         $button.attr('aria-expanded', 'true');
//         $('body').addClass('health-category-sheet-open');
//     });

//     $dim.on('click', closeCategorySheet);
//     $(document).on('keydown', function(event){
//         if (event.key === 'Escape' && !$sheet.prop('hidden')) closeCategorySheet();
//     });
// });


$(function () {
    const ROOT_PARENT_CATE_NO = 1;

    const categoryTabs = {
        tabSwipers: {},
        categoryMap: {},
        childrenMap: {},

        init: function () {
            categoryTabs.bindTabNavigation();
            categoryTabs.fetchCategories();
        },
        isSameCategoryTabUrl: function (href) {
            try {
                var nextUrl = new URL(href, window.location.origin);
                var currentUrl = new URL(window.location.href);

                return (
                    nextUrl.pathname === currentUrl.pathname &&
                    nextUrl.searchParams.get('cate_no') ===
                        currentUrl.searchParams.get('cate_no')
                );
            } catch (error) {
                return false;
            }
        },

        bindTabNavigation: function () {
            $(document)
                .off('click.categoryTabReplace')
                .on(
                    'click.categoryTabReplace',
                    '.category-tabs__list a, .category-sub-tabs__list a',
                    function (event) {
                        var href = $(this).attr('href');

                        if (
                            !href ||
                            href === '#none' ||
                            href.indexOf('javascript:') === 0
                        ) {
                            return;
                        }

                        if ($(this).attr('target') === '_blank') {
                            return;
                        }

                        if (
                            event.metaKey ||
                            event.ctrlKey ||
                            event.shiftKey ||
                            event.altKey ||
                            event.which === 2
                        ) {
                            return;
                        }

                        event.preventDefault();

                        if (categoryTabs.isSameCategoryTabUrl(href)) {
                            return;
                        }

                        window.location.replace(href);
                    }
                );
        },

        initTabSwiper: function (
            key,
            swiperSelector,
            listSelector
        ) {
            if (categoryTabs.tabSwipers[key]) {
                categoryTabs.tabSwipers[key].destroy(true, true);
                categoryTabs.tabSwipers[key] = null;
            }

            const activeIndex =
                $(listSelector).children('.selected').index();

            categoryTabs.tabSwipers[key] =
                new Swiper(swiperSelector, {
                    slidesPerView: 'auto',
                    spaceBetween: 20,
                    loop: false,
                    freeMode: true,
                    watchOverflow: true,
                    observer: true,
                    observeParents: true
                });

            if (activeIndex > -1) {
                categoryTabs.tabSwipers[key].slideTo(
                    activeIndex,
                    0
                );
            }
        },

        fetchCategories: function () {
            $.ajax({
                url: '/exec/front/Product/SubCategory',
                dataType: 'json',

                success: function (data) {
                    if (!data || !data.length) {
                        $(
                            '.category-tabs, .category-sub-tabs'
                        ).hide();

                        return;
                    }

                    categoryTabs.buildMaps(data);
                    categoryTabs.renderCategoryTabs();
                },

                error: function (xhr, status, error) {
                    $(
                        '.category-tabs, .category-sub-tabs'
                    ).hide();

                    console.log(
                        '카테고리 ajax error',
                        status,
                        error
                    );
                }
            });
        },

        buildMaps: function (data) {
            categoryTabs.categoryMap = {};
            categoryTabs.childrenMap = {};

            $.each(data, function (_, category) {
                const cateNo =
                    Number(category.cate_no);

                const parentCateNo =
                    Number(category.parent_cate_no);

                categoryTabs.categoryMap[cateNo] =
                    category;

                if (
                    !categoryTabs.childrenMap[
                    parentCateNo
                    ]
                ) {
                    categoryTabs.childrenMap[
                        parentCateNo
                    ] = [];
                }

                categoryTabs.childrenMap[
                    parentCateNo
                ].push(category);
            });
        },

        getCurrentCateNo: function () {
            const href = window.location.href;

            const queryMatch =
                href.match(/[?&]cate_no=(\d+)/);

            const seoMatch =
                href.match(
                    /\/category\/[^/]+\/(\d+)/
                );

            if (queryMatch) {
                return Number(queryMatch[1]);
            }

            if (seoMatch) {
                return Number(seoMatch[1]);
            }

            return null;
        },

        getAncestors: function (cateNo) {
            const ancestors = [];
            let currentCateNo = Number(cateNo);

            while (
                currentCateNo &&
                categoryTabs.categoryMap[
                currentCateNo
                ]
            ) {
                const category =
                    categoryTabs.categoryMap[
                    currentCateNo
                    ];

                ancestors.unshift(category);

                const parentCateNo =
                    Number(
                        category.parent_cate_no
                    );

                if (
                    !parentCateNo ||
                    !categoryTabs.categoryMap[
                    parentCateNo
                    ]
                ) {
                    break;
                }

                currentCateNo = parentCateNo;
            }

            return ancestors;
        },

        renderCategoryTabs: function () {
            const currentCateNo =
                categoryTabs.getCurrentCateNo();

            const ancestors =
                categoryTabs.getAncestors(
                    currentCateNo
                );

            const activeRoot =
                ancestors[0] || null;

            const activeMiddle =
                ancestors[1] || null;

            categoryTabs.renderRootTabs(
                activeRoot
                    ? Number(activeRoot.cate_no)
                    : null
            );

            /*
             * 중분류 탭 사용 시 아래 주석 해제
             * HTML의 .category-sub-tabs 영역도
             * 함께 주석 해제
             */

            // categoryTabs.renderMiddleTabs(
            //     activeRoot
            //         ? Number(activeRoot.cate_no)
            //         : null,
            //     activeMiddle
            //         ? Number(activeMiddle.cate_no)
            //         : null
            // );
        },

        renderRootTabs: function (activeCateNo) {
            const $tabs =
                $('.category-tabs');

            const $tabList =
                $tabs.find(
                    '.category-tabs__list'
                );

            const rootList =
                categoryTabs.childrenMap[
                ROOT_PARENT_CATE_NO
                ] || [];

            $tabList.empty();

            if (!rootList.length) {
                $tabs.hide();
                return;
            }

            $.each(
                rootList,
                function (_, category) {
                    const cateNo =
                        Number(
                            category.cate_no
                        );

                    const isActive =
                        cateNo ===
                        Number(activeCateNo);

                    $('<li>', {
                        id:
                            'category-tab-' +
                            cateNo,

                        class:
                            'swiper-slide' +
                            (
                                isActive
                                    ? ' selected'
                                    : ''
                            )
                    }).append(
                        $('<a>', {
                            href:
                                '/product/list.html?cate_no=' +
                                cateNo,

                            text:
                                category.name
                        })
                    ).appendTo($tabList);
                }
            );

            categoryTabs.initTabSwiper(
                'root',
                '.category-tab-swiper',
                '.category-tabs__list'
            );

            $tabs.show();
        },

        renderMiddleTabs: function (
            rootCateNo,
            activeCateNo
        ) {
            const $tabs =
                $('.category-sub-tabs');

            const $tabList =
                $tabs.find(
                    '.category-sub-tabs__list'
                );

            const middleList =
                categoryTabs.childrenMap[
                rootCateNo
                ] || [];

            $tabList.empty();

            if (
                !rootCateNo ||
                !middleList.length
            ) {
                $tabs.hide();
                return;
            }

            $.each(
                middleList,
                function (_, category) {
                    const cateNo =
                        Number(
                            category.cate_no
                        );

                    const isActive =
                        cateNo ===
                        Number(activeCateNo);

                    $('<li>', {
                        id:
                            'category-sub-tab-' +
                            cateNo,

                        class:
                            'swiper-slide' +
                            (
                                isActive
                                    ? ' selected'
                                    : ''
                            )
                    }).append(
                        $('<a>', {
                            href:
                                '/product/list.html?cate_no=' +
                                cateNo,

                            text:
                                category.name
                        })
                    ).appendTo($tabList);
                }
            );

            categoryTabs.initTabSwiper(
                'middle',
                '.category-sub-tab-swiper',
                '.category-sub-tabs__list'
            );

            $tabs.show();
        }
    };

    categoryTabs.init();
});