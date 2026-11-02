(function () {
    'use strict';

    if (window.__ownedCouponListBooted) return;
    window.__ownedCouponListBooted = true;

    // var NOTE_TEXT = '표시된 최대할인가는 예상 금액이며, 실제 할인은 주문 조건에 따라 달라질 수 있습니다.';
    var settled = null;
    var settledLoginState = '';
    var startSeq = 0;
    var loginRetries = 0;
    var differLog = {};

    var suppressObserver = false;
    var pendingCards = false;
    var paintGeneration = 0;

    function listRoots() {
        var found = [];
        function add(node) {
            if (!node || found.indexOf(node) !== -1) return;
            found.push(node);
        }
        var mains = document.querySelectorAll('.main-prod');
        for (var i = 0; i < mains.length; i++) add(mains[i]);
        var marked = document.querySelectorAll('[data-owned-coupon-list]');
        for (var j = 0; j < marked.length; j++) add(marked[j]);
        return found;
    }

    function isMainRoot(root) {
        return !!(root && root.classList.contains('main-prod'));
    }

    function rootToken(root) {
        if (isMainRoot(root)) return window.__listPriceLookupToken || 1;
        return Number(root.getAttribute('data-owned-coupon-price-token') || '1');
    }

    function rootAborted(root) {
        if (isMainRoot(root)) return !!window.__listPriceLookupAborted;
        return root.getAttribute('data-owned-coupon-price-aborted') === '1';
    }

    function itemsIn(root) {
        return root.querySelectorAll('.prdList__item');
    }

    function eachItem(visitor, root) {
        var roots = root ? [root] : listRoots();
        for (var r = 0; r < roots.length; r++) {
            var items = itemsIn(roots[r]);
            for (var i = 0; i < items.length; i++) visitor(items[i]);
        }
    }

    function countItems(readyOnly) {
        var count = 0;
        var roots = listRoots();
        for (var r = 0; r < roots.length; r++) {
            var items = itemsIn(roots[r]);
            for (var i = 0; i < items.length; i++) {
                if (!readyOnly || items[i].classList.contains('is-owned-coupon-price')) count += 1;
            }
        }
        return count;
    }

    function releaseRoot(root) {
        if (isMainRoot(root)) {
            if (typeof window.__releaseListPriceLoading === 'function') window.__releaseListPriceLoading();
            return;
        }
        if (typeof root.__releaseOwnedCouponPrices === 'function') root.__releaseOwnedCouponPrices();
    }

    function restartRoot(root) {
        if (isMainRoot(root)) {
            if (typeof window.__restartListPriceLoading === 'function') window.__restartListPriceLoading();
            return;
        }
        if (typeof root.__restartOwnedCouponPrices === 'function') root.__restartOwnedCouponPrices();
    }

    function releaseRoots() {
        var roots = listRoots();
        for (var i = 0; i < roots.length; i++) releaseRoot(roots[i]);
    }

    function restartRoots() {
        var roots = listRoots();
        for (var i = 0; i < roots.length; i++) restartRoot(roots[i]);
    }

    function endPaintGuard() {
        var generation = ++paintGeneration;
        window.setTimeout(function () {
            if (generation !== paintGeneration) return;
            suppressObserver = false;
            if (!pendingCards) return;
            pendingCards = false;
            applyMore();
        }, 0);
    }

    function finishWithoutCoupon(root) {
        suppressObserver = true;
        try {
            eachItem(function (item) {
                removeBlanketCouponLabel(item);
                clearCouponPrice(item);
                item.classList.add('is-list-price-ready');
            }, root);
        } finally {
            endPaintGuard();
        }
    }

    function activeRoots() {
        return listRoots().filter(function (root) { return !rootAborted(root); });
    }

    function boot() {
        if (!listRoots().length) return;
        if (!window.GcOwnedCoupon) {
            releaseRoots();
            return;
        }
        observeMore();
        window.addEventListener('pageshow', onPageShow);
        window.addEventListener('gc-owned-coupon-login-changed', onLoginStateChanged);
        start();
    }

    function onPageShow(event) {
        if (!event.persisted || !listRoots().length || !window.GcOwnedCoupon) return;
        window.GcOwnedCoupon.reset('BFCache 복귀');
        settled = null;
        settledLoginState = '';
        loginRetries = 0;
        restartRoots();
        eachItem(clearCouponPrice);
        start();
    }

    function onLoginStateChanged() {
        if (!listRoots().length || !window.GcOwnedCoupon) return;
        settled = null;
        settledLoginState = '';
        loginRetries = 0;
        restartRoots();
        eachItem(clearCouponPrice);
        start();
    }

    function start() {
        var roots = activeRoots();
        if (!roots.length) {
            listRoots().forEach(finishWithoutCoupon);
            return;
        }
        if (!document.querySelector('.main-prod .prdList__item, [data-owned-coupon-list] .prdList__item')) {
            releaseRoots();
            return;
        }

        var captured = roots.map(function (root) {
            return { root: root, token: rootToken(root) };
        });
        var seq = ++startSeq;
        var loginState = window.GcOwnedCoupon.readLoginState();
        console.info('[LIST][OWNED_COUPON]', {
            event: '쿠폰 조회 시작',
            loginState: loginState,
            requestToken: captured[0].token
        });

        window.GcOwnedCoupon.loadCatalog().then(function (result) {
            if (seq !== startSeq) return;
            var nowState = window.GcOwnedCoupon.readLoginState();
            var loginChanged = !!result && result.status === 'stale' ||
                (loginState !== 'unknown' && nowState !== 'unknown' && nowState !== loginState);
            if (!result || loginChanged) {
                console.info('[LIST][OWNED_COUPON]', {
                    event: '응답 무효',
                    reason: '로그인 상태 전환',
                    requestToken: captured[0].token
                });
                settled = null;
                settledLoginState = '';
                if (loginRetries < 1) {
                    loginRetries += 1;
                    start();
                    return;
                }
                captured.forEach(function (entry) { finishWithoutCoupon(entry.root); });
                releaseRoots();
                return;
            }

            loginRetries = 0;
            console.info('[LIST][PRICE_TIMING]', { event: '조회 완료', now: Math.round(performance.now()) });
            var applied = false;
            captured.forEach(function (entry) {
                if (rootAborted(entry.root) || rootToken(entry.root) !== entry.token) {
                    finishWithoutCoupon(entry.root);
                    console.info('[LIST][OWNED_COUPON]', { event: '응답 무효', reason: '복구 제한', requestToken: entry.token });
                    return;
                }
                applyRoot(entry.root, result);
                releaseRoot(entry.root);
                applied = true;
            });
            if (!applied) return;
            settled = result;
            settledLoginState = nowState === 'unknown' ? loginState : nowState;
            console.info('[LIST][PRICE_TIMING]', { event: '가격 반영 완료', now: Math.round(performance.now()) });
            console.info('[LIST][OWNED_COUPON]', {
                event: 'UI 표시',
                status: result.status,
                coupons: (result.coupons || []).length,
                cards: countItems(false),
                shown: countItems(true)
            });
        });
    }

    function observeMore() {
        if (typeof MutationObserver === 'undefined') return;
        listRoots().forEach(observeRoot);
    }

    function isProductCardNode(node) {
        if (!node || node.nodeType !== 1) return false;
        if (node.classList && node.classList.contains('prdList__item')) return true;
        if (node.matches && (node.matches('.prdList__item') || node.matches('li[id^="anchorBoxId_"]'))) return true;
        return !!(node.querySelector && node.querySelector('.prdList__item, li[id^="anchorBoxId_"]'));
    }

    function observeRoot(root) {
        var timer = 0;
        new MutationObserver(function (records) {
            var hasCard = false;
            for (var i = 0; i < records.length; i++) {
                var added = records[i].addedNodes;
                for (var n = 0; n < added.length; n++) {
                    if (isProductCardNode(added[n])) hasCard = true;
                }
            }
            if (!hasCard) return;
            if (suppressObserver) {
                pendingCards = true;
                return;
            }
            window.clearTimeout(timer);
            timer = window.setTimeout(applyMore, 50);
        }).observe(root, { childList: true, subtree: true });
    }

    function applyMore() {
        listRoots().forEach(function (root) {
            if (!rootAborted(root)) return;
            eachItem(function (item) {
                if (!item.classList.contains('is-list-price-ready')) item.classList.add('is-list-price-ready');
            }, root);
        });
        var nowState = window.GcOwnedCoupon ? window.GcOwnedCoupon.readLoginState() : '';
        if (settled && nowState !== 'unknown' && settledLoginState !== 'unknown' && nowState !== settledLoginState) {
            window.GcOwnedCoupon.reset('로그인 상태 전환');
            settled = null;
            settledLoginState = '';
            restartRoots();
            eachItem(clearCouponPrice);
            start();
            return;
        }
        if (!settled) return;
        activeRoots().forEach(function (root) { applyRoot(root, settled); });
    }

    function applyRoot(root, result) {
        suppressObserver = true;
        try {
            eachItem(function (item) {
                removeBlanketCouponLabel(item);
                if (!result || result.status !== 'ready') {
                    clearCouponPrice(item);
                    item.classList.add('is-list-price-ready');
                    return;
                }

                var productNo = productNoFromItem(item);
                var salePrice = readOriginSalePrice(item, productNo);
                var coupons = (result.coupons || []).filter(function (coupon) {
                    return productNo && (coupon.productNos || []).indexOf(String(productNo)) !== -1;
                });
                var discount = salePrice ? window.GcOwnedCoupon.selectLargest(salePrice, coupons) : 0;
                if (!(discount > 0)) {
                    clearCouponPrice(item);
                    item.classList.add('is-list-price-ready');
                    return;
                }
                paintCouponPrice(item, salePrice, discount);
            }, root);
        } finally {
            endPaintGuard();
        }
        // 안내 문구(NOTE_TEXT) 미노출: 빈 .main-owned-coupon-note 요소도 만들지 않음
        // syncNote();
    }

    function productNoFromItem(item) {
        var productLi = item.closest('li[id^="anchorBoxId_"]');
        if (!productLi) return '';
        return productLi.id.replace('anchorBoxId_', '');
    }

    function parseWon(text) {
        var match = String(text || '').replace(/\([^)]*\)/g, '').match(/[\d,]+/);
        if (!match) return 0;
        var value = Number(match[0].replace(/,/g, ''));
        return Number.isFinite(value) && value > 0 ? value : 0;
    }

    function readOriginSalePrice(item, productNo) {
        var stored = Number(item.getAttribute('data-origin-sale-price'));
        if (stored > 0) return stored;

        var description = item.querySelector('.description');
        var fromAttr = description ? parseWon(description.getAttribute('ec-data-price')) : 0;
        var saleLi = findSaleLi(item);
        var fromText = 0;
        if (saleLi) {
            var origin = saleLi.querySelector('.list-coupon-sale-origin');
            if (origin) {
                fromText = parseWon(origin.textContent);
            } else {
                var clone = saleLi.cloneNode(true);
                var extras = clone.querySelectorAll('.list-coupon-sale-amount, .list-coupon-rate, .percent-text, .price-label, .title, .list-coupon-label');
                for (var i = 0; i < extras.length; i++) extras[i].remove();
                fromText = parseWon(clone.textContent);
            }
        }

        if (fromText && fromAttr && fromText !== fromAttr && productNo && !differLog[productNo]) {
            differLog[productNo] = true;
            console.info('[LIST][OWNED_COUPON]', {
                event: '판매가 기준',
                productNo: String(productNo),
                rendered: fromText,
                ecDataPrice: fromAttr,
                reason: '화면 판매가를 쿠폰 차감 기준으로 사용'
            });
        }

        var value = fromText || fromAttr;
        if (value > 0) item.setAttribute('data-origin-sale-price', String(value));
        return value;
    }

    function specTitle(li) {
        var titleEl = li.querySelector(':scope > .title') || li;
        var text = '';
        titleEl.childNodes.forEach(function (node) {
            if (node.nodeType === 1 && node.classList.contains('price-label')) return;
            text += node.textContent;
        });
        return text.replace(/[\s:]/g, '');
    }

    function findSaleLi(item) {
        var spec = item.querySelector('ul.spec');
        if (!spec) return null;
        var rows = spec.children;
        for (var i = 0; i < rows.length; i++) {
            var title = specTitle(rows[i]);
            if (title === '판매가' || title === '구매가') return rows[i];
        }
        return null;
    }

    function findConsumerLi(item) {
        var spec = item.querySelector('ul.spec');
        if (!spec) return null;
        var rows = spec.children;
        for (var i = 0; i < rows.length; i++) {
            if (specTitle(rows[i]) === '소비자가') return rows[i];
        }
        return null;
    }

    // 소비자가(ec-data-custom) 대비 쿠폰 적용가 할인율. sale.js와 같은 기준(소비자가 → 판매가 순)
    function couponSalePercent(item, salePrice, discount) {
        var finalPrice = salePrice - discount;
        if (!(finalPrice > 0)) return 0;
        var description = item.querySelector('.description');
        var consumer = description ? parseWon(description.getAttribute('ec-data-custom')) : 0;
        var base = consumer > finalPrice ? consumer : salePrice;
        if (!(base > finalPrice)) return 0;
        return Math.round(100 - (finalPrice * 100) / base);
    }

    // [미사용] .sale_box는 prod.css에서 숨김 처리됨. 보이는 할인율은 .list-coupon-rate
    function paintSaleBox(item, finalPrice) {
        var saleBox = item.querySelector('.sale_box');
        if (!saleBox) return;
        var description = item.querySelector('.description');
        var consumer = description ? parseWon(description.getAttribute('ec-data-custom')) : 0;
        if (!(consumer > finalPrice)) return;

        if (!item.hasAttribute('data-origin-sale-box')) {
            item.setAttribute('data-origin-sale-box', saleBox.textContent);
        }
        var pct = Math.round(100 - (finalPrice * 100) / consumer);
        if (pct > 0) saleBox.textContent = pct + '%';
    }

    function restoreSaleBox(item) {
        if (!item.hasAttribute('data-origin-sale-box')) return;
        var saleBox = item.querySelector('.sale_box');
        if (saleBox) saleBox.textContent = item.getAttribute('data-origin-sale-box');
        item.removeAttribute('data-origin-sale-box');
    }

    function removeBlanketCouponLabel(item) {
        var labels = item.querySelectorAll('.price-label');
        for (var i = 0; i < labels.length; i++) {
            if (labels[i].textContent.replace(/\s+/g, '') === '쿠폰적용가') labels[i].remove();
        }
    }

    function ensureOrigin(saleLi) {
        var existing = saleLi.querySelector('.list-coupon-sale-origin');
        if (existing) return existing;

        var children = saleLi.children;
        for (var i = 0; i < children.length; i++) {
            var child = children[i];
            if (child.classList.contains('title') || child.classList.contains('percent-text') || child.classList.contains('list-coupon-label') || child.classList.contains('list-coupon-sale-amount') || child.classList.contains('price-label') || child.classList.contains('discount-rate')) continue;
            if (/[\d,]+원/.test(child.textContent || '')) {
                child.classList.add('list-coupon-sale-origin');
                return child;
            }
        }

        var textNode = null;
        for (var n = 0; n < saleLi.childNodes.length; n++) {
            var node = saleLi.childNodes[n];
            if (node.nodeType === 3 && /[\d,]+원/.test(node.nodeValue || '')) {
                textNode = node;
                break;
            }
        }
        if (!textNode) return null;
        var span = document.createElement('span');
        span.className = 'list-coupon-sale-origin';
        textNode.parentNode.insertBefore(span, textNode);
        span.appendChild(textNode);
        return span;
    }

    function paintCouponPrice(item, salePrice, discount) {
        var saleLi = findSaleLi(item);
        if (!saleLi) return;

        var expectedText = window.GcOwnedCoupon.formatWon(Math.max(0, salePrice - discount));
        var existingAmount = saleLi.querySelector('.list-coupon-sale-amount');
        if (item.getAttribute('data-applied-coupon-discount') === String(discount) && existingAmount && existingAmount.textContent === expectedText) {
            item.classList.add('is-owned-coupon-price', 'is-list-price-ready');
            saleLi.classList.add('price-li', 'is-owned-coupon-price');
            return;
        }

        var origin = ensureOrigin(saleLi);
        if (!origin) return;

        var stray = saleLi.querySelectorAll('.percent-text');
        for (var i = 0; i < stray.length; i++) {
            if (!stray[i].classList.contains('list-coupon-rate')) stray[i].remove();
        }

        // [기존] 최대할인가 라벨을 판매가 li 안에 삽입
        // var label = saleLi.querySelector('.list-coupon-label');
        // if (!label) {
        //     label = document.createElement('span');
        //     label.className = 'list-coupon-label';
        //     saleLi.insertBefore(label, origin);
        // }
        // label.textContent = '최대할인가';

        // 최대할인가 라벨: 소비자가 li의 마지막 자식으로 이동
        var label = item.querySelector('.list-coupon-label');
        if (!label) {
            label = document.createElement('span');
            label.className = 'list-coupon-label';
        }
        label.textContent = '최대할인가';
        var consumerLi = findConsumerLi(item);
        if (consumerLi) {
            if (label.parentNode !== consumerLi || consumerLi.lastElementChild !== label) consumerLi.appendChild(label);
        } else if (label.parentNode !== saleLi) {
            saleLi.insertBefore(label, origin);
        }

        // [기존] 판매가 대비 쿠폰 % (예: 14%)
        // var percent = window.GcOwnedCoupon.salePercent(discount, salePrice);

        // 소비자가 대비 최대할인가(쿠폰 적용가) 기준 할인율. 소비자가가 없거나 더 낮으면 판매가 기준
        var percent = couponSalePercent(item, salePrice, discount);
        var rate = saleLi.querySelector('.list-coupon-rate');
        if (percent > 0) {
            if (!rate) {
                rate = document.createElement('span');
                rate.className = 'percent-text list-coupon-rate';
                rate.innerHTML = '<span class="sale-num"></span>';
                saleLi.insertBefore(rate, origin);
            }
            var rateHtml = percent + '<span class="percent-sign">%</span>';
            var num = rate.querySelector('.sale-num');
            if (num && num.innerHTML !== rateHtml) num.innerHTML = rateHtml;
        } else if (rate) {
            rate.remove();
        }

        var amount = saleLi.querySelector('.list-coupon-sale-amount');
        if (!amount) {
            amount = document.createElement('span');
            amount.className = 'list-coupon-sale-amount';
            saleLi.insertBefore(amount, origin);
        }
        if (amount.textContent !== expectedText) amount.textContent = expectedText;

        // 라벨을 판매가 li 안에서 다시 정렬하던 줄 (라벨이 소비자가 li로 이동하므로 사용 안 함)
        // if (label.nextElementSibling !== (percent > 0 ? rate : amount)) saleLi.insertBefore(label, percent > 0 ? rate : amount);
        // .sale_box는 CSS(prod.css)로 숨김 처리되어 있어 사용 안 함
        // paintSaleBox(item, salePrice - discount);
        origin.classList.add('list-coupon-sale-origin');
        origin.setAttribute('aria-hidden', 'true');
        item.setAttribute('data-applied-coupon-discount', String(discount));
        item.classList.add('is-owned-coupon-price', 'is-list-price-ready');
        saleLi.classList.add('price-li', 'is-owned-coupon-price');
    }

    function clearCouponPrice(item) {
        item.classList.remove('is-owned-coupon-price');
        item.removeAttribute('data-applied-coupon-discount');
        var movedLabels = item.querySelectorAll('.list-coupon-label');
        for (var j = 0; j < movedLabels.length; j++) movedLabels[j].remove();
        // restoreSaleBox(item);
        var saleLi = findSaleLi(item);
        if (!saleLi) return;
        saleLi.classList.remove('is-owned-coupon-price');
        var nodes = saleLi.querySelectorAll('.list-coupon-label, .list-coupon-rate, .list-coupon-sale-amount');
        for (var i = 0; i < nodes.length; i++) nodes[i].remove();
        var origin = saleLi.querySelector('.list-coupon-sale-origin');
        if (origin) {
            origin.classList.remove('list-coupon-sale-origin');
            origin.removeAttribute('aria-hidden');
        }
    }

    function syncNote() {
        var note = document.querySelector('.main-prod .main-owned-coupon-note');
        var shown = document.querySelector('.main-prod .prdList__item.is-owned-coupon-price');
        if (!shown) {
            if (note) note.hidden = true;
            return;
        }
        if (!note) {
            var root = document.querySelector('.main-prod');
            if (!root) return;
            note = document.createElement('p');
            note.className = 'main-owned-coupon-note';
            root.appendChild(note);
        }
        // note.textContent = NOTE_TEXT;
        note.hidden = false;
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
