$(function () {
    $('.period-toggle').on('click', function () {
        const $button = $(this);
        const $periodSearch = $button.closest('.period-search');
        const isOpen = $periodSearch.toggleClass('is-open').hasClass('is-open');

        $button.attr('aria-expanded', isOpen);
    });

    // 기간 버튼 클릭 시 selected 이동 
    // $('.period-search .period').on('click', 'a[days]', function () {
    //     $(this).addClass('selected').siblings('a[days]').removeClass('selected');
    // });

    initOrderHistoryTabReplace();
});


/* =====================================================
   주문내역조회 ↔ 취소/반품/교환 탭 → History replace
   (동일 list.html 내 상태 변경, list_old/list_past는 제외)
===================================================== */
function isOrderListPath(pathname) {
    return /\/myshop\/order\/list\.html$/.test(pathname);
}

// pathname + query 전체 비교 (파라미터 순서 무시)
function isSameOrderHistoryUrl(href) {
    try {
        const next = new URL(href, window.location.origin);
        const current = new URL(window.location.href);

        if (next.pathname !== current.pathname) {
            return false;
        }

        const nextParams = Array.from(next.searchParams.entries()).sort();
        const currentParams = Array.from(current.searchParams.entries()).sort();

        return JSON.stringify(nextParams) === JSON.stringify(currentParams);
    } catch (e) {
        return false;
    }
}

function initOrderHistoryTabReplace() {
    $(document)
        .off('click.orderHistoryTabReplace')
        .on(
            'click.orderHistoryTabReplace',
            '.myshopArea .xans-myshop-orderhistorytab .menu a',
            function (event) {
                const href = $(this).attr('href');

                if (!href || href === '#none' || href.indexOf('javascript:') === 0) {
                    return;
                }

                if ($(this).attr('target') === '_blank') {
                    return;
                }

                if (
                    event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.which === 2
                ) {
                    return;
                }

                let nextUrl;

                try {
                    nextUrl = new URL(href, window.location.origin);
                } catch (e) {
                    return;
                }

                // list.html ↔ list.html 탭만 replace (list_old / list_past는 push 유지)
                if (
                    !isOrderListPath(window.location.pathname) || !isOrderListPath(nextUrl.pathname)
                ) {
                    return;
                }

                event.preventDefault();

                if (isSameOrderHistoryUrl(href)) {
                    return;
                }

                window.location.replace(href);
            }
        );
}