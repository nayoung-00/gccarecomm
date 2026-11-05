(function () {
    if (typeof window.__bootOwnedCouponListPrices === 'function') return;

    window.__bootOwnedCouponListPrices = function (root, scope) {
        if (!root || !root.hasAttribute('data-owned-coupon-list')) return;
        if (root.getAttribute('data-owned-coupon-price-booted') === '1') return;
        root.setAttribute('data-owned-coupon-price-booted', '1');

        var LIMIT = window.GC_OWNED_COUPON_RECOVERY_MS || 8000;
        var timer = 0;
        root.setAttribute('data-owned-coupon-price-token', '1');
        root.setAttribute('data-owned-coupon-price-aborted', '0');
        root.setAttribute('aria-busy', 'true');

        function specTitle(li) {
            var titleEl = li.querySelector(':scope > .title') || li;
            var text = '';
            titleEl.childNodes.forEach(function (node) {
                if (node.nodeType === 1 && node.classList.contains('price-label')) return;
                text += node.textContent;
            });
            return text.replace(/[\s:]/g, '');
        }

        function markNode(node) {
            if (!node || node.nodeType !== 1 || !root.contains(node)) return;
            var rows = [];
            if (node.matches && node.matches('ul.spec > li')) rows.push(node);
            if (node.querySelectorAll) {
                var found = node.querySelectorAll('ul.spec > li');
                for (var i = 0; i < found.length; i++) rows.push(found[i]);
            }
            for (var j = 0; j < rows.length; j++) {
                var title = specTitle(rows[j]);
                if (title === '소비자가') rows[j].setAttribute('data-owned-coupon-price-row', 'consumer');
                else if (title === '판매가' || title === '구매가') rows[j].setAttribute('data-owned-coupon-price-row', 'sale');
            }
        }

        function markAll() {
            markNode(root);
        }

        root.__markOwnedCouponPriceRows = markAll;

        if (typeof MutationObserver !== 'undefined') {
            new MutationObserver(function (records) {
                for (var i = 0; i < records.length; i++) {
                    var added = records[i].addedNodes;
                    for (var n = 0; n < added.length; n++) markNode(added[n]);
                }
            }).observe(root, { childList: true, subtree: true });
        }

        function reveal(reason) {
            if (timer) {
                window.clearTimeout(timer);
                timer = 0;
            }
            var cards = root.querySelectorAll('.prdList__item');
            for (var i = 0; i < cards.length; i++) cards[i].classList.add('is-list-price-ready');
            root.removeAttribute('aria-busy');
        }

        function abort() {
            root.setAttribute('data-owned-coupon-price-aborted', '1');
            root.setAttribute('data-owned-coupon-price-token', String(Number(root.getAttribute('data-owned-coupon-price-token') || '1') + 1));
            reveal('복구 제한');
        }

        root.__releaseOwnedCouponPrices = function () {
            reveal('');
        };
        root.__restartOwnedCouponPrices = function () {
            root.setAttribute('data-owned-coupon-price-aborted', '0');
            root.setAttribute('data-owned-coupon-price-token', String(Number(root.getAttribute('data-owned-coupon-price-token') || '1') + 1));
            var cards = root.querySelectorAll('.prdList__item');
            for (var i = 0; i < cards.length; i++) cards[i].classList.remove('is-list-price-ready');
            root.setAttribute('aria-busy', 'true');
            if (timer) window.clearTimeout(timer);
            timer = window.setTimeout(abort, LIMIT);
        };

        timer = window.setTimeout(abort, LIMIT);
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', markAll);
        else markAll();
    };
})();
