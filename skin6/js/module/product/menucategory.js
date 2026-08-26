$(function(){
    if($(".menuCategory > li").length==0){
        $(".ec-base-tab.typeMenu").hide();	//중분류 없으면 영역 숨김 - 정환
    }else {
        $(".menuCategory li").each(function(i){
            var ulElChk = $(this).find('ul').length;
            if(ulElChk == 0){
                $(this).find('.iconWrap').remove();
            }
        });

        var domWidth = $(document).width();
        if(domWidth < 1024){
			if($(".display_tablet_only .menuCategory > li").length==0){
				$(".ec-base-tab.typeMenu").hide();	//Mobile에서 마지막분류 없으면 영역 숨김 - 정환
			}

            $(".menuCategory .iconWrap").on('click', function(e){
                var target = $(this).closest('li');
                var ulEl = returnTarget(target);
                var ulElchk = ulEl.hasClass('active');

                if(ulElchk){
                    var classChk = $(this).closest('ul').hasClass('active');
                    if(!classChk){ heightCheck(ulEl, "out"); }
                    mouseEvent(target, "out");

                    target.find('ul').removeClass('active');
                }else{
                    heightCheck(ulEl, "hover");
                    mouseEvent(target, "hover");
                }
                target.siblings('li').find('ul').removeClass('active');

            });
        }else{
            $(".menuCategory li").hover(function() {
                mouseEvent($(this), "hover");
            }, function(){
                mouseEvent($(this), "out");
            });
        }
    };

    function mouseEvent(_this, str){
        var target = returnTarget(_this);
        str == "hover" ? target.addClass('active') : target.removeClass('active');
    }

    function returnTarget(_this){
        var target = _this.children('ul');
        var ulElChk = target.length;
        if(ulElChk == 0){ target = _this.children('.button').children('ul') }

        return target;
    }

    function heightCheck(ulEl, str){
        if(str == "out"){
            $('.menuCategory.menu').css({"height":""});
        }else{
            var height = ulEl.outerHeight(true);
            var menuHeight = $('.menuCategory .menu li').outerHeight(true);
            var cul = (menuHeight+height)+10;

            $('.menuCategory.menu').css({"height":cul});
        }
    };

});

$(function(){
    var $selector = $('.health-category-selector');
    var $button = $selector.find('.health-category-selector__button');
    var $current = $selector.find('.health-category-selector__current');
    var $sheet = $('#healthCategorySheet');
    var $dim = $('.health-category-selector__dim');

    if (!$selector.length || !$sheet.length) return;

    var rootCategoryUrl = '/product/list.html?cate_no=47';

    function cateNoFromUrl(url) {
        var targetUrl = url || '';
        var queryMatch = targetUrl.match(/[?&]cate_no=([^&/]+)/);
        var pathMatch = targetUrl.match(/\/(\d+)\/?(?:[?#].*)?$/);
        return queryMatch ? queryMatch[1] : (pathMatch ? pathMatch[1] : '');
    }

    var currentCateNo = cateNoFromUrl(window.location.href) || '47';

    function makeCategoryMenu($sourceMenu) {
        var $menu = $('<nav/>', { 'class': 'health-category-selector__menu', 'aria-label': '카테고리' });
        var seenLinks = {};

        $('<a/>', { href: rootCategoryUrl, text: '전체' })
            .toggleClass('is-selected', currentCateNo === '47')
            .appendTo($menu);
        seenLinks[rootCategoryUrl] = true;

        $sourceMenu.find('a[href]').each(function(){
            var $link = $(this);
            var href = $link.attr('href');
            var name = $.trim($link.clone().children().remove().end().text());

            if (!href || href === '#none' || !name || seenLinks[href]) return;
            seenLinks[href] = true;

            $('<a/>', { href: href, text: name })
                .toggleClass('is-selected', cateNoFromUrl(href) === currentCateNo)
                .appendTo($menu);
        });

        $sheet.find('.health-category-selector__menu').remove();
        // $sheet.append($('<p/>', { 'class': 'health-category-selector__sheet-title', text: '전체' }));
        $sheet.append($menu);

        var $selected = $menu.find('.is-selected').first();
        if ($selected.length) $current.removeClass('is-loading').removeAttr('aria-busy').text($selected.text());
    }

    $current.addClass('is-loading').attr('aria-busy', 'true').text('카테고리 불러오는 중');
    makeCategoryMenu($sheet.find('.display_tablet_only .menuCategory').first());

    $.get(rootCategoryUrl).done(function(response){
        var $response = $('<div/>').append($.parseHTML(response, document, false));
        var $rootMenu = $response.find('#healthCategorySheet .display_tablet_only .menuCategory').first();

        if ($rootMenu.length) {
            makeCategoryMenu($rootMenu);
        } else {
            makeCategoryMenu($sheet.find('.display_tablet_only .menuCategory').first());
        }
    }).fail(function(){
        makeCategoryMenu($sheet.find('.display_tablet_only .menuCategory').first());
        $current.removeClass('is-loading').removeAttr('aria-busy');
    });

    function closeCategorySheet() {
        $sheet.prop('hidden', true);
        $dim.prop('hidden', true);
        $button.attr('aria-expanded', 'false');
        $('body').removeClass('health-category-sheet-open');
    }

    $button.on('click', function(){
        $sheet.prop('hidden', false);
        $dim.prop('hidden', false);
        $button.attr('aria-expanded', 'true');
        $('body').addClass('health-category-sheet-open');
    });

    $dim.on('click', closeCategorySheet);
    $(document).on('keydown', function(event){
        if (event.key === 'Escape' && !$sheet.prop('hidden')) closeCategorySheet();
    });
});
