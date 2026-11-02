(function () {
    'use strict';

    if (window.GcOwnedCoupon) return;

    /* 상세·메인 목록이 같이 쓰는 보유 쿠폰 조회와 예상 할인 계산.
       정률의 소수 원 버림은 화면 표시 정책이며, 카페24 주문서 계산과 같다고 두지 않는다.
       복구 제한 8000ms는 측정값이 아닌 임시값이다. */
    var RECOVERY_MS = 8000;
    var LIST_URL = '/myshop/coupon/coupon.html';
    var PRODUCT_LIST_URL = '/myshop/coupon/coupon_product_list.html';
    var PAGE_LIMIT = 30;
    var FETCH_CONCURRENCY = 4;
    var KST_OFFSET_MS = 9 * 60 * 60 * 1000;

    var catalogToken = 0;
    var catalogRun = 0;
    var catalogKey = '';
    var catalogPromise = null;
    var productCache = new Map();
    var productInflight = new Map();
    var confirmedLoginState = '';
    var detailWatchers = [];
    var activeDetailBridge = null;
    var detailTimingArmed = false;
    var detailConfirmAt = 0;
    var catalogCompletedAt = 0;
    var LOGIN_STATE_WAIT_MS = 50;
    var LOGIN_STATE_WAIT_TRIES = 20;

    window.GC_OWNED_COUPON_RECOVERY_MS = RECOVERY_MS;

    /* front/config.js 와 같다. ?debug=1 이거나 FRONT.config.DEBUG 일 때만 상세 로그를 낸다. */
    function ownedCouponDebugEnabled() {
        try {
            if (window.FRONT && window.FRONT.config && window.FRONT.config.DEBUG === true) return true;
            return /[?&]debug=1/.test(String(window.location.search || ''));
        } catch (e) {
            return false;
        }
    }

    /* logged-in / logged-out / unknown 은 로그인 모듈이 보이는지만 나타낸다.
       모듈 문구나 장바구니 수량은 포함하지 않으며, 회원 식별자로 쓰지 않는다. */
    function readLoginState() {
        if (typeof document === 'undefined') return 'unknown';
        if (countVisible('.xans-layout-statelogon') > 0) return 'logged-in';
        if (countVisible('.xans-layout-statelogoff') > 0) return 'logged-out';
        return 'unknown';
    }

    function countVisible(selector) {
        var nodes = document.querySelectorAll(selector);
        var count = 0;
        for (var i = 0; i < nodes.length; i++) {
            if (!isHiddenModule(nodes[i])) count += 1;
        }
        return count;
    }

    function logonTextLength() {
        var nodes = document.querySelectorAll('.xans-layout-statelogon');
        var best = 0;
        for (var i = 0; i < nodes.length; i++) {
            if (isHiddenModule(nodes[i])) continue;
            var text = String(nodes[i].textContent || '').replace(/\s+/g, ' ').trim();
            if (text.length > best) best = text.length;
        }
        return best;
    }

    function whenLoginStateKnown() {
        return new Promise(function (resolve) {
            var tries = 0;
            function tick() {
                var state = readLoginState();
                if (state !== 'unknown') {
                    resolve(state);
                    return;
                }
                tries += 1;
                if (tries >= LOGIN_STATE_WAIT_TRIES) {
                    console.info('[OWNED_COUPON][LOGIN_STATE]', {
                        event: '로그인 모듈 미확정',
                        reason: '보이는 로그인·로그아웃 모듈이 없어 상태를 확정하지 않음',
                        tries: tries
                    });
                    resolve('unknown');
                    return;
                }
                window.setTimeout(tick, LOGIN_STATE_WAIT_MS);
            }
            tick();
        });
    }

    function isHiddenModule(el) {
        var node = el;
        while (node && node.nodeType === 1) {
            if (node.classList.contains('displaynone')) return true;
            node = node.parentElement;
        }
        return false;
    }

    function reset(reason) {
        console.info('[OWNED_COUPON][RESET]', {
            reason: reason || '미지정',
            run: catalogRun,
            loginState: readLoginState()
        });
        catalogToken += 1;
        catalogKey = '';
        catalogPromise = null;
        productCache = new Map();
        productInflight = new Map();
        detailWatchers = [];
        activeDetailBridge = null;
        detailTimingArmed = false;
        detailConfirmAt = 0;
        catalogCompletedAt = 0;
    }

    function noteLoginState(next, reason) {
        if (!next || next === 'unknown') return;
        if (!confirmedLoginState) {
            confirmedLoginState = next;
            if (catalogKey === 'unknown') {
                invalidateForLoginChange(reason);
            }
            return;
        }
        if (confirmedLoginState === next) return;
        confirmedLoginState = next;
        invalidateForLoginChange(reason);
    }

    function invalidateForLoginChange(reason) {
        reset(reason || '로그인 상태 전환');
        try {
            window.dispatchEvent(new CustomEvent('gc-owned-coupon-login-changed'));
        } catch (e) {
            // 이 브라우저에 CustomEvent가 없으면 호출부가 완료 시점의 상태 차이로 다시 조회한다.
        }
    }

    function kstWallTimeToEpoch(text) {
        var match = String(text || '').trim().match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
        if (!match) return null;

        var year = Number(match[1]);
        var month = Number(match[2]);
        var day = Number(match[3]);
        var hour = Number(match[4]);
        var minute = Number(match[5]);
        var second = Number(match[6]);
        if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;

        var epoch = Date.UTC(year, month - 1, day, hour, minute, second) - KST_OFFSET_MS;
        var check = new Date(epoch + KST_OFFSET_MS);
        if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
        return epoch;
    }

    function parseKstPeriod(text) {
        var match = String(text || '').trim().match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s*~\s*(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})$/);
        if (!match) return null;

        var start = kstWallTimeToEpoch(match[1]);
        var end = kstWallTimeToEpoch(match[2]);
        if (start == null || end == null || end < start) return null;
        return { start: start, end: end };
    }

    function isKstPeriodActive(period, nowMs) {
        return nowMs >= period.start && nowMs < period.end + 1000;
    }

    function normalizeOwnedCouponText(text) {
        return String(text || '')
            .replace(/[\u200b-\u200d\ufeff]/g, '')
            .replace(/\s+/g, '');
    }

    function parseOwnedCouponDiscount(text) {
        var value = normalizeOwnedCouponText(text);
        var fixed = value.match(/^([\d,]+)원$/);
        if (fixed) {
            var amount = Number(fixed[1].replace(/,/g, ''));
            if (!Number.isFinite(amount) || amount <= 0) return null;
            return { type: 'fixed', amount: amount };
        }

        var rate = value.match(/^(\d+(?:\.\d+)?)%$/);
        if (rate) {
            var rateValue = Number(rate[1]);
            if (!Number.isFinite(rateValue) || rateValue <= 0) return null;
            return { type: 'rate', rate: rateValue };
        }

        return null;
    }

    function formatOwnedCouponParsed(discount) {
        if (!discount) return '';
        if (discount.type === 'fixed') return 'fixed ' + discount.amount;
        return 'rate ' + discount.rate;
    }

    function benefitAgrees(discount, benefitText) {
        var text = normalizeOwnedCouponText(benefitText);
        if (!text || !discount) return false;

        if (discount.type === 'fixed') {
            var match = text.match(/([\d,]+)원/);
            return !!match && Number(match[1].replace(/,/g, '')) === discount.amount;
        }

        var match = text.match(/(\d+(?:\.\d+)?)%/);
        return !!match && Number(match[1]) === discount.rate;
    }

    function parsePrintedCap(text) {
        var value = String(text || '').replace(/\s+/g, ' ').trim();
        if (!value || value === '제한없음') return { state: 'absent' };

        var amounts = value.match(/[\d,]+원/g) || [];
        if (amounts.length !== 1) return { state: 'unparsed' };

        var amount = Number(amounts[0].replace(/[^\d]/g, ''));
        if (!Number.isFinite(amount) || amount < 0) return { state: 'unparsed' };
        return { state: 'amount', amount: amount };
    }

    function estimateOwnedCouponDiscount(salePrice, coupon) {
        var amount = coupon.type === 'fixed'
            ? coupon.amount
            : Math.floor(salePrice * coupon.rate / 100);

        if (coupon.capWon != null) amount = Math.min(amount, coupon.capWon);
        if (!Number.isFinite(amount) || amount < 0) amount = 0;
        if (amount > salePrice) amount = salePrice;
        return amount;
    }

    function selectLargest(salePrice, coupons) {
        var best = 0;
        var list = coupons || [];
        for (var i = 0; i < list.length; i++) {
            var amount = estimateOwnedCouponDiscount(salePrice, list[i]);
            if (amount > best) best = amount;
        }
        return best;
    }

    function salePercent(discount, salePrice) {
        if (!(salePrice > 0) || !(discount > 0)) return 0;
        return Math.round(discount / salePrice * 100);
    }

    function formatWon(value) {
        return Number(value || 0).toLocaleString('ko-KR') + '원';
    }

    function extractCouponLookupNo(source) {
        var match = String(source || '').match(/coupon_product_popup\(\s*['"][^'"]*['"]\s*,\s*['"]([^'"]+)['"]\s*\)/);
        return match ? match[1] : '';
    }

    function productNoFromHref(href) {
        var queryMatch = String(href || '').match(/[?&]product_no=(\d+)/);
        if (queryMatch) return queryMatch[1];

        var seoMatch = String(href || '').match(/\/product\/(?:[^/]+\/)*(\d+)\/category\//);
        return seoMatch ? seoMatch[1] : '';
    }

    function pagingAllowed(href, origin, kind, lookupNo) {
        var url;
        try {
            url = new URL(href, origin);
        } catch (e) {
            return false;
        }

        if (url.origin !== origin) return false;
        if (kind === 'coupon') return /\/coupon\.html$/.test(url.pathname);
        if (!/\/coupon_product_list\.html$/.test(url.pathname)) return false;
        if (lookupNo) {
            var param = url.searchParams.get('coupon_no');
            if (param && param !== String(lookupNo)) return false;
        }
        return true;
    }

    function toSameOriginUrl(href, baseUrl, origin) {
        try {
            var url = new URL(href, baseUrl);
            if (url.origin !== origin) return '';
            return url.href;
        } catch (e) {
            return '';
        }
    }

    function logOwnedCouponDiagnosis(entry) {
        var payload = {
            discountRaw: entry.discountRaw || '',
            parsed: entry.parsed || '',
            productNo: entry.productNo == null ? '' : String(entry.productNo),
            applicableCount: (entry.applicableProductNos || []).length,
            reason: entry.reason || ''
        };
        if (ownedCouponDebugEnabled()) {
            payload.lookupNo = entry.lookupNo == null ? '' : String(entry.lookupNo);
            payload.applicableProductNos = entry.applicableProductNos || [];
        }
        console.info('[DETAIL][OWNED_COUPON]', payload);
    }

    function couponDetailItem(tbody, label) {
        var items = tbody.querySelectorAll('li');
        for (var i = 0; i < items.length; i++) {
            var strong = items[i].querySelector('strong');
            if (strong && strong.textContent.trim() === label) return items[i];
        }
        return null;
    }

    function couponDetailText(tbody, label) {
        var item = couponDetailItem(tbody, label);
        if (!item) return '';
        var content = item.querySelector('.content');
        return content ? String(content.textContent || '').replace(/[\u200b-\u200d\ufeff]/g, '').trim() : '';
    }

    function couponLookupNo(tbody) {
        var nodes = tbody.querySelectorAll('[onclick]');
        for (var i = 0; i < nodes.length; i++) {
            var lookupNo = extractCouponLookupNo(nodes[i].getAttribute('onclick'));
            if (lookupNo) return lookupNo;
        }
        return '';
    }

    function benefitResultText(tbody) {
        var item = couponDetailItem(tbody, '쿠폰혜택');
        if (!item) return '';
        var content = item.querySelector('.content');
        if (!content) return '';

        var clone = content.cloneNode(true);
        var children = clone.children;
        for (var i = children.length - 1; i >= 0; i--) {
            if (!children[i].classList.contains('notranslate')) children[i].remove();
        }
        return String(clone.textContent || '').replace(/[\u200b-\u200d\ufeff]/g, '').trim();
    }

    function discountColumnAfterBreak(tbody) {
        var cells = tbody.querySelectorAll('tr td');
        for (var i = 0; i < cells.length; i++) {
            var label = cells[i].querySelector('.display_tablet_only');
            if (!label || label.textContent.trim() !== '할인') continue;

            var parts = cells[i].innerHTML.split(/<br\s*\/?>/i);
            if (parts.length < 2) return '';

            var holder = tbody.ownerDocument.createElement('div');
            holder.innerHTML = parts.slice(1).join(' ');
            return holder.textContent.trim();
        }
        return '';
    }

    function benefitCapText(tbody) {
        var item = couponDetailItem(tbody, '쿠폰혜택');
        if (!item) return '';
        var content = item.querySelector('.content');
        if (!content) return '';

        var parts = [];
        var children = content.children;
        for (var i = 0; i < children.length; i++) {
            if (children[i].classList.contains('notranslate')) continue;
            parts.push(children[i].textContent.trim());
        }
        return parts.join(' ').trim();
    }

    function resolvePrintedCap(tbody) {
        var summary = parsePrintedCap(discountColumnAfterBreak(tbody));
        var benefit = parsePrintedCap(benefitCapText(tbody));
        if (summary.state === 'unparsed' || benefit.state === 'unparsed') return { ok: false };
        if (summary.state === 'amount' && benefit.state === 'amount' && summary.amount !== benefit.amount) return { ok: false };
        if (summary.state === 'amount') return { ok: true, capWon: summary.amount };
        if (benefit.state === 'amount') return { ok: true, capWon: benefit.amount };
        return { ok: true, capWon: null };
    }

    function purchaseAllowsEstimate(tbody) {
        var item = couponDetailItem(tbody, '구매금액');
        if (!item) return false;
        return item.querySelector('.content') && item.querySelector('.content').textContent.trim() === '제한없음';
    }

    function paymethodAllowsEstimate(tbody) {
        var item = couponDetailItem(tbody, '결제수단');
        if (!item || item.classList.contains('displaynone')) return true;
        var content = item.querySelector('.content');
        return !!content && content.textContent.trim() === '제한없음';
    }

    function readCouponCandidate(tbody, nowMs) {
        var lookupNo = couponLookupNo(tbody);
        var discountRaw = couponDetailText(tbody, '할인액(률)');
        var discount = parseOwnedCouponDiscount(discountRaw);
        var diagnosis = {
            lookupNo: lookupNo,
            discountRaw: discountRaw,
            parsed: formatOwnedCouponParsed(discount),
            productNo: '',
            applicableProductNos: []
        };

        function exclude(reason) {
            diagnosis.reason = reason;
            logOwnedCouponDiagnosis(diagnosis);
            return null;
        }

        if (!lookupNo) return exclude('보유 쿠폰 추출: 조회용 번호 없음');
        if (!discount) return exclude('정액·정률 판별: 할인액(률) 파싱 실패');
        if (!benefitAgrees(discount, benefitResultText(tbody))) return exclude('정액·정률 판별: 쿠폰혜택 숫자·단위 불일치');
        if (!purchaseAllowsEstimate(tbody)) return exclude('구매금액 조건 미확인');
        if (!paymethodAllowsEstimate(tbody)) return exclude('결제수단 조건 미확인');

        var period = parseKstPeriod(couponDetailText(tbody, '사용가능 기간'));
        if (!period || !isKstPeriodActive(period, nowMs)) return exclude('사용기간 아님');

        var cap = resolvePrintedCap(tbody);
        if (!cap.ok) return exclude('할인한도 표기 해석 불가');

        return {
            lookupNo: String(lookupNo),
            type: discount.type,
            amount: discount.amount || 0,
            rate: discount.rate || 0,
            capWon: cap.capWon,
            discountRaw: discountRaw,
            parsed: formatOwnedCouponParsed(discount)
        };
    }

    function mergeCouponCandidates(list) {
        var map = new Map();
        list.forEach(function (item) {
            if (!item || item.lookupNo == null || item.lookupNo === '') return;
            var lookupNo = String(item.lookupNo);
            item.lookupNo = lookupNo;
            if (!map.has(lookupNo)) {
                map.set(lookupNo, item);
                return;
            }

            var prev = map.get(lookupNo);
            if (!prev) return;

            var same = prev.type === item.type &&
                prev.amount === item.amount &&
                prev.rate === item.rate &&
                prev.capWon === item.capWon;
            if (!same) map.set(lookupNo, null);
        });

        var merged = [];
        map.forEach(function (item) {
            if (item) merged.push(item);
        });
        return merged;
    }

    function collectPagingHrefs(doc, selector) {
        var root = doc.querySelector(selector);
        if (!root) return [];

        var hrefs = [];
        var anchors = root.querySelectorAll('a[href]');
        for (var i = 0; i < anchors.length; i++) {
            var anchor = anchors[i];
            if (anchor.classList.contains('displaynone')) continue;
            if (anchor.parentElement && anchor.parentElement.classList.contains('displaynone')) continue;

            var href = anchor.getAttribute('href');
            if (!href) continue;
            var value = href.trim();
            if (!value || value === '#' || value.charAt(0) === '#') continue;
            if (/^javascript:/i.test(value)) continue;
            hrefs.push(value);
        }
        return hrefs;
    }

    function staleError() {
        var error = new Error('stale');
        error.kind = 'stale';
        return error;
    }

    function fetchHtmlDocument(url) {
        return fetch(url, { credentials: 'include' }).then(function (response) {
            if (!response.ok) {
                var error = new Error('owned coupon fetch failed');
                error.kind = 'fetch';
                throw error;
            }

            var finalUrl = response.url || url;
            if (String(finalUrl).indexOf('/member/login') !== -1) {
                var loginError = new Error('login');
                loginError.kind = 'login';
                throw loginError;
            }

            return response.text().then(function (html) {
                return {
                    doc: new DOMParser().parseFromString(html, 'text/html'),
                    url: finalUrl
                };
            });
        });
    }

    function pageRequestKey(absolute) {
        var parsed = new URL(absolute);
        var rawPage = parsed.searchParams.get('page');
        var page = rawPage == null || rawPage === '' || Number(rawPage) === 1 ? '1' : String(rawPage);
        var isProductList = /coupon_product_list\.html$/.test(parsed.pathname);
        var pairs = [];
        var names = [];
        parsed.searchParams.forEach(function (value, key) {
            if (key === 'page') return;
            if (isProductList && (key === 'limit' || key === 'search' || key === 'search_key') && value === '') return;
            pairs.push(key + '=' + value);
            names.push(key);
        });
        pairs.sort();
        names.sort();
        var requestKind = /coupon_product_list\.html$/.test(parsed.pathname) ? '적용상품' : '쿠폰목록';
        return {
            identity: parsed.origin + parsed.pathname + '|p=' + page + '|' + pairs.join('&'),
            log: {
                kind: requestKind,
                page: page,
                params: names.join(',') || '없음'
            }
        };
    }

    async function fetchPagedDocuments(startUrl, pagingSelector, kind, lookupNo, requestToken) {
        var visited = new Set();
        var docs = [];
        var queue = [];
        var origin = window.location.origin;

        function enqueue(href, baseUrl) {
            var absolute = toSameOriginUrl(href, baseUrl, origin);
            if (!absolute || !pagingAllowed(absolute, origin, kind, lookupNo)) return;
            var key = pageRequestKey(absolute);
            if (visited.has(key.identity)) {
                if (ownedCouponDebugEnabled()) {
                    console.info('[OWNED_COUPON][PAGE]', {
                        kind: key.log.kind,
                        page: key.log.page,
                        params: key.log.params,
                        duplicate: true
                    });
                }
                return;
            }
            visited.add(key.identity);
            queue.push(absolute);
        }

        enqueue(startUrl, origin);
        while (queue.length) {
            if (requestToken !== catalogToken) throw staleError();
            if (docs.length >= PAGE_LIMIT) {
                var error = new Error('owned coupon page limit');
                error.kind = 'fetch';
                throw error;
            }

            var pageUrl = queue.shift();
            var started = pageRequestKey(pageUrl);
            console.info('[OWNED_COUPON][PAGE]', {
                kind: started.log.kind,
                page: started.log.page,
                params: started.log.params,
                duplicate: false
            });
            var loaded = await fetchHtmlDocument(pageUrl);
            if (requestToken !== catalogToken) throw staleError();
            docs.push(loaded.doc);
            collectPagingHrefs(loaded.doc, pagingSelector).forEach(function (href) {
                enqueue(href, loaded.url);
            });
        }
        return docs;
    }

    function loadProductSet(lookupNo, requestToken) {
        var key = String(lookupNo);
        if (requestToken !== catalogToken) return Promise.reject(staleError());
        if (productCache.has(key)) return Promise.resolve(Array.from(productCache.get(key)));
        var existing = productInflight.get(key);
        if (existing) return existing;

        var promise = storeProductSet(key, requestToken).finally(function () {
            if (productInflight.get(key) === promise) productInflight.delete(key);
        });
        productInflight.set(key, promise);
        return promise;
    }

    async function storeProductSet(key, requestToken) {
        if (requestToken !== catalogToken) throw staleError();

        var startUrl = PRODUCT_LIST_URL + '?coupon_no=' + encodeURIComponent(key);
        var docs = await fetchPagedDocuments(startUrl, '.xans-myshop-couponproductpaging', 'product', key, requestToken);
        if (requestToken !== catalogToken) throw staleError();

        var found = new Set();
        docs.forEach(function (doc) {
            var anchors = doc.querySelectorAll('.xans-myshop-couponproductlist a[href]');
            for (var i = 0; i < anchors.length; i++) {
                var product = productNoFromHref(anchors[i].getAttribute('href'));
                if (product) found.add(String(product));
            }
        });
        if (requestToken !== catalogToken) throw staleError();
        productCache.set(key, found);
        return Array.from(found);
    }

    function couponWithProducts(coupon, productNos) {
        logOwnedCouponDiagnosis({
            lookupNo: coupon.lookupNo,
            discountRaw: coupon.discountRaw,
            parsed: coupon.parsed,
            productNo: '',
            applicableProductNos: productNos,
            reason: '적용 상품 목록 적재'
        });
        return {
            lookupNo: coupon.lookupNo,
            type: coupon.type,
            amount: coupon.amount,
            rate: coupon.rate,
            capWon: coupon.capWon,
            discountRaw: coupon.discountRaw,
            parsed: coupon.parsed,
            productNos: productNos
        };
    }

    /* 적용 상품 조회는 목록 페이지 수집과 별도로, 실행 전체에서 최대 4개만 진행한다.
       상세가 구독 중일 때만, 조건 수집이 끝난 뒤 아직 시작하지 않은 작업을 예상 할인액 큰 순으로 다시 둔다. */
    function createProductWorkQueue(requestToken) {
        var pending = [];
        var active = 0;
        var queued = new Set();
        var outcomes = new Map();
        var listOpen = true;
        var held = false;
        var idleWaiters = [];
        var settleListeners = [];

        function notify() {
            if (listOpen || active !== 0 || pending.length !== 0) return;
            var waiters = idleWaiters.splice(0);
            for (var i = 0; i < waiters.length; i++) waiters[i]();
        }

        function pump() {
            if (held) return;
            while (active < FETCH_CONCURRENCY && pending.length) {
                var coupon = pending.shift();
                active += 1;
                (function (current) {
                    var key = String(current.lookupNo);
                    loadProductSet(key, requestToken).then(function (productNos) {
                        outcomes.set(key, { ok: true, coupon: current, productNos: productNos });
                    }, function (error) {
                        outcomes.set(key, { ok: false, error: error });
                    }).then(function () {
                        active -= 1;
                        for (var i = 0; i < settleListeners.length; i++) settleListeners[i]();
                        pump();
                        notify();
                    });
                })(coupon);
            }
            notify();
        }

        return {
            enqueue: function (coupon) {
                if (!coupon || coupon.lookupNo == null || coupon.lookupNo === '') return;
                var key = String(coupon.lookupNo);
                if (queued.has(key)) return;
                queued.add(key);
                pending.push(coupon);
                pump();
            },
            hold: function (paused) {
                held = !!paused;
                if (!held) pump();
            },
            prioritize: function (salePrice) {
                var price = Number(salePrice) || 0;
                if (!(price > 0) || pending.length < 2) return;
                var indexed = [];
                for (var i = 0; i < pending.length; i++) {
                    indexed.push({
                        coupon: pending[i],
                        index: i,
                        ceiling: estimateOwnedCouponDiscount(price, pending[i])
                    });
                }
                indexed.sort(function (left, right) {
                    if (right.ceiling !== left.ceiling) return right.ceiling - left.ceiling;
                    return left.index - right.index;
                });
                pending = indexed.map(function (item) { return item.coupon; });
            },
            onSettle: function (listener) {
                if (typeof listener === 'function') settleListeners.push(listener);
            },
            snapshot: function () {
                return outcomes;
            },
            closeList: function () {
                listOpen = false;
                notify();
            },
            finished: function () {
                if (!listOpen && active === 0 && pending.length === 0) return Promise.resolve(outcomes);
                return new Promise(function (resolve) {
                    idleWaiters.push(function () { resolve(outcomes); });
                });
            }
        };
    }

    function timingNow() {
        if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
        return 0;
    }

    function logDetailTiming(event, extra) {
        if (!detailTimingArmed) return;
        var payload = { event: event, now: Math.round(timingNow()) };
        if (extra) {
            for (var key in extra) {
                if (Object.prototype.hasOwnProperty.call(extra, key) && extra[key] != null) payload[key] = extra[key];
            }
        }
        console.info('[DETAIL][PRICE_TIMING]', payload);
    }

    function logCatalogCompleted(requestToken, result) {
        if (requestToken !== catalogToken) return result;
        catalogCompletedAt = timingNow();
        logDetailTiming('전체 카탈로그 완료', {
            status: result && result.status ? result.status : '',
            earlierMs: detailConfirmAt ? Math.round(catalogCompletedAt - detailConfirmAt) : 0
        });
        return result;
    }

    function watcherSalePrice() {
        for (var i = 0; i < detailWatchers.length; i++) {
            if (typeof detailWatchers[i].getSalePrice !== 'function') continue;
            var salePrice = Number(detailWatchers[i].getSalePrice()) || 0;
            if (salePrice > 0) return salePrice;
        }
        return 0;
    }

    function detailCouponCandidate(coupon, productNos) {
        return {
            lookupNo: coupon.lookupNo,
            type: coupon.type,
            amount: coupon.amount,
            rate: coupon.rate,
            capWon: coupon.capWon,
            discountRaw: coupon.discountRaw,
            parsed: coupon.parsed,
            productNos: productNos
        };
    }

    function productSetIncludes(productNos, productNo) {
        var key = String(productNo);
        var list = productNos || [];
        for (var i = 0; i < list.length; i++) {
            if (String(list[i]) === key) return true;
        }
        return false;
    }

    /* 확인된 적용 할인보다 더 큰 상한의 미확인·실패 쿠폰이 없을 때만 확정한다. 같은 금액은 기다리지 않는다. */
    function decideDetailDiscount(productNo, salePrice, coupons, outcomes) {
        var price = Number(salePrice) || 0;
        if (!(price > 0)) return { pending: true, status: '', candidates: [] };

        var list = coupons || [];
        var best = 0;
        var applicable = [];
        var ceilings = new Array(list.length);
        for (var i = 0; i < list.length; i++) {
            ceilings[i] = estimateOwnedCouponDiscount(price, list[i]);
            var known = outcomes.get(String(list[i].lookupNo));
            if (!known || !known.ok || !productSetIncludes(known.productNos, productNo)) continue;
            if (ceilings[i] > best) best = ceilings[i];
            if (ceilings[i] > 0) applicable.push(detailCouponCandidate(list[i], known.productNos));
        }

        for (var j = 0; j < list.length; j++) {
            if (!(ceilings[j] > best)) continue;
            var outcome = outcomes.get(String(list[j].lookupNo));
            if (!outcome) return { pending: true, status: '', candidates: [] };
            if (!outcome.ok) {
                var error = outcome.error;
                if (error && error.kind === 'stale') return { pending: false, status: 'stale', candidates: [] };
                if (error && error.kind === 'login') return { pending: false, status: 'login', candidates: [] };
                return { pending: false, status: 'fetch-fail', candidates: [] };
            }
        }

        if (!applicable.length || best <= 0) return { pending: false, status: 'no-match', candidates: [] };
        return { pending: false, status: 'ready', candidates: applicable };
    }

    function openDetailBridge(scheduler, requestToken) {
        var bridge = {
            listClosed: false,
            coupons: [],
            sync: function () {
                if (requestToken !== catalogToken || !bridge.listClosed) return;
                var salePrice = watcherSalePrice();
                if (salePrice > 0) scheduler.prioritize(salePrice);
                bridge.emit();
            },
            emit: function () {
                if (requestToken !== catalogToken || !bridge.listClosed) return;
                var snapshot = scheduler.snapshot();
                var watchers = detailWatchers.slice();
                for (var i = 0; i < watchers.length; i++) {
                    var watcher = watchers[i];
                    if (typeof watcher.getSalePrice !== 'function' || typeof watcher.onDecision !== 'function') continue;
                    var salePrice = Number(watcher.getSalePrice()) || 0;
                    if (!(salePrice > 0)) {
                        watcher.onDecision({ pending: true, status: '', candidates: [] });
                        continue;
                    }
                    watcher.onDecision(decideDetailDiscount(watcher.productNo, salePrice, bridge.coupons, snapshot));
                }
            },
            publishConditions: function (coupons) {
                if (requestToken !== catalogToken) return;
                bridge.coupons = coupons || [];
                bridge.listClosed = true;
                logDetailTiming('전체 쿠폰 조건 수집 완료', { couponCount: bridge.coupons.length });
                bridge.sync();
            }
        };

        scheduler.onSettle(function () {
            bridge.sync();
        });
        activeDetailBridge = bridge;
        return bridge;
    }

    function publishStandaloneConditions(coupons, requestToken) {
        if (requestToken !== catalogToken) return;
        var scheduler = createProductWorkQueue(requestToken);
        scheduler.closeList();
        openDetailBridge(scheduler, requestToken).publishConditions(coupons);
    }

    function catalogFromOutcomes(coupons, outcomes, loginState, requestToken) {
        if (requestToken !== catalogToken) return emptyCatalog('stale');
        if (!coupons.length) return emptyCatalog('no-match');

        var withProducts = [];
        for (var i = 0; i < coupons.length; i++) {
            var coupon = coupons[i];
            var outcome = outcomes.get(String(coupon.lookupNo));
            if (!outcome || !outcome.ok) {
                var error = outcome && outcome.error;
                if (error && error.kind === 'stale') return emptyCatalog('stale');
                if (error && error.kind === 'login') return emptyCatalog('login');
                return emptyCatalog('fetch-fail');
            }
            withProducts.push(couponWithProducts(outcome.coupon, outcome.productNos));
        }
        return { status: 'ready', loginState: loginState, coupons: withProducts };
    }

    function watchProductDiscount(spec) {
        detailTimingArmed = true;
        var watcher = {
            productNo: String(spec && spec.productNo || ''),
            getSalePrice: spec && spec.getSalePrice,
            onDecision: spec && spec.onDecision
        };
        detailWatchers.push(watcher);
        if (activeDetailBridge) activeDetailBridge.sync();
        return function () {
            var index = detailWatchers.indexOf(watcher);
            if (index !== -1) detailWatchers.splice(index, 1);
        };
    }

    function reevaluateProductDiscount() {
        if (!activeDetailBridge || typeof activeDetailBridge.sync !== 'function') return false;
        activeDetailBridge.sync();
        return true;
    }

    function noteDetailPriceConfirmed() {
        if (!detailConfirmAt) detailConfirmAt = timingNow();
    }

    function emptyCatalog(status) {
        return { status: status, coupons: [] };
    }

    function whenDomReady() {
        if (typeof document === 'undefined' || document.readyState !== 'loading') return Promise.resolve();
        return new Promise(function (resolve) {
            document.addEventListener('DOMContentLoaded', function () {
                resolve();
            }, { once: true });
        });
    }

    function normalizePageNumber(value) {
        if (value == null || value === '' || Number(value) === 1) return '1';
        if (!/^\d+$/.test(String(value))) return '';
        return String(value);
    }

    function pageNumberFromHref(href, baseUrl) {
        try {
            var url = new URL(href, baseUrl || window.location.href);
            return normalizePageNumber(url.searchParams.get('page'));
        } catch (e) {
            return '';
        }
    }

    function couponListUrlForPage(page) {
        if (page === '1') return LIST_URL;
        return LIST_URL + '?page=' + encodeURIComponent(page);
    }

    function couponRecordNodes(root) {
        if (!root || !root.querySelectorAll) return [];
        return Array.prototype.slice.call(root.querySelectorAll('.xans-myshop-couponlist tbody.xans-record-'));
    }

    function pageNumbersFromPaging(root, baseUrl) {
        var numbers = [];
        if (!root) return numbers;
        var anchors = root.querySelectorAll('a[href]');
        for (var i = 0; i < anchors.length; i++) {
            var href = anchors[i].getAttribute('href');
            if (!href || href.charAt(0) === '#' || /^javascript:/i.test(href)) continue;
            var number = pageNumberFromHref(href, baseUrl);
            if (number && numbers.indexOf(number) === -1) numbers.push(number);
        }
        return numbers;
    }

    function markedCouponPage(pagingRoot) {
        if (!pagingRoot || !pagingRoot.querySelector) return '';
        var marked = pagingRoot.querySelector('a.this, li.this > a, a.selected, li.selected > a');
        if (!marked) return '';
        var text = String(marked.textContent || '').replace(/\s+/g, '');
        if (/^\d+$/.test(text)) return normalizePageNumber(text);
        return pageNumberFromHref(marked.getAttribute('href'), window.location.href);
    }

    /* 상세의 리뷰·문의 페이징도 page를 쓸 수 있다. 쿠폰 영역 밖의 링크가 같은 번호면 쿠폰 페이지로 보지 않는다. */
    function locationPageClaimedOutsideCoupon() {
        if (typeof document === 'undefined') return false;
        var current = normalizePageNumber(new URL(window.location.href).searchParams.get('page'));
        if (!current || current === '1') return false;
        var couponRoot = document.getElementById('ownedCouponData');
        var anchors = document.querySelectorAll('a[href]');
        for (var i = 0; i < anchors.length; i++) {
            if (couponRoot && couponRoot.contains(anchors[i])) continue;
            if (pageNumberFromHref(anchors[i].getAttribute('href')) === current) return true;
        }
        return false;
    }

    function embeddedCouponPage(pagingRoot) {
        var marked = markedCouponPage(pagingRoot);
        if (marked) return marked;
        if (locationPageClaimedOutsideCoupon()) return '';
        return normalizePageNumber(new URL(window.location.href).searchParams.get('page'));
    }

    function seenCouponPages(page) {
        var seen = new Set();
        if (page) seen.add(page);
        return seen;
    }

    function readEmbeddedCouponList() {
        if (typeof document === 'undefined') return { state: 'absent' };
        var root = document.getElementById('ownedCouponData');
        if (!root) return { state: 'absent' };
        if (root.innerHTML.indexOf('{$') !== -1) return { state: 'unusable' };

        var list = root.querySelector('.xans-myshop-couponlist');
        if (!list) return { state: 'unusable' };

        var records = couponRecordNodes(root);
        if (records.length) {
            var pagingRoot = root.querySelector('.xans-myshop-couponlistpaging');
            return {
                state: 'ready',
                records: records,
                page: embeddedCouponPage(pagingRoot),
                pages: pageNumbersFromPaging(pagingRoot)
            };
        }

        var emptyNode = root.querySelector('.ec-base-prdEmpty');
        if (emptyNode && !isHiddenModule(emptyNode)) return { state: 'none' };
        return { state: 'unusable' };
    }

    function logCouponListSummary(entry) {
        console.info('[OWNED_COUPON][LIST]', {
            event: '쿠폰 목록 집계',
            reason: entry.reason || '',
            domCount: entry.domCount,
            extraPages: entry.extraPages,
            couponCount: entry.couponCount
        });
    }

    async function fetchOtherCouponPages(seedPages, seenPages, requestToken, onPageRecords) {
        var records = [];
        var fetched = 0;
        var queue = seedPages.filter(function (page) {
            return page && !seenPages.has(page);
        });

        while (queue.length) {
            if (requestToken !== catalogToken) throw staleError();
            if (fetched >= PAGE_LIMIT) {
                var limitError = new Error('owned coupon page limit');
                limitError.kind = 'fetch';
                throw limitError;
            }

            var page = queue.shift();
            if (!page || seenPages.has(page)) continue;
            seenPages.add(page);
            var pageUrl = couponListUrlForPage(page);
            console.info('[OWNED_COUPON][PAGE]', {
                kind: '쿠폰목록',
                page: page,
                params: '없음',
                duplicate: false
            });
            var loaded = await fetchHtmlDocument(pageUrl);
            if (requestToken !== catalogToken) throw staleError();
            fetched += 1;
            var pageRecords = couponRecordNodes(loaded.doc);
            records = records.concat(pageRecords);
            if (typeof onPageRecords === 'function') onPageRecords(pageRecords);
            pageNumbersFromPaging(loaded.doc.querySelector('.xans-myshop-couponlistpaging'), loaded.url).forEach(function (number) {
                if (!seenPages.has(number) && queue.indexOf(number) === -1) queue.push(number);
            });
        }

        return { records: records, fetched: fetched };
    }

    async function loadCouponRecords(requestToken) {
        await whenDomReady();
        var embedded = readEmbeddedCouponList();
        if (embedded.state === 'none') {
            return { status: 'none', records: [], domCount: 0, extraPages: 0, reason: '쿠폰 없음' };
        }
        if (embedded.state === 'ready') {
            var seenPages = seenCouponPages(embedded.page);
            var extra = await fetchOtherCouponPages(embedded.pages, seenPages, requestToken);
            return {
                status: 'ready',
                records: embedded.records.concat(extra.records),
                domCount: embedded.records.length,
                extraPages: extra.fetched,
                reason: 'DOM'
            };
        }

        console.info('[OWNED_COUPON][LIST]', {
            event: '전체 조회',
            reason: embedded.state === 'absent' ? '모듈 없음' : '모듈 사용 불가'
        });
        var docs = await fetchPagedDocuments(LIST_URL, '.xans-myshop-couponlistpaging', 'coupon', '', requestToken);
        var hasList = docs.some(function (doc) {
            return !!doc.querySelector('.xans-myshop-couponlist');
        });
        if (!hasList) return { status: 'login', records: [] };
        var records = [];
        docs.forEach(function (doc) {
            records = records.concat(couponRecordNodes(doc));
        });
        if (!records.length) return { status: 'none', records: [], domCount: 0, extraPages: docs.length, reason: '쿠폰 없음' };
        return { status: 'ready', records: records, domCount: 0, extraPages: docs.length, reason: '전체 조회' };
    }

    async function completeEmbeddedCatalog(loginState, requestToken, embedded) {
        var nowMs = Date.now();
        var parsed = [];
        var merged = [];
        var scheduler = createProductWorkQueue(requestToken);
        var bridge = openDetailBridge(scheduler, requestToken);

        function absorb(records) {
            for (var i = 0; i < records.length; i++) parsed.push(readCouponCandidate(records[i], nowMs));
            merged = mergeCouponCandidates(parsed);
            for (var j = 0; j < merged.length; j++) scheduler.enqueue(merged[j]);
        }

        absorb(embedded.records);
        if (detailWatchers.length) scheduler.hold(true);
        var extra;
        try {
            extra = await fetchOtherCouponPages(embedded.pages, seenCouponPages(embedded.page), requestToken, absorb);
        } catch (error) {
            scheduler.closeList();
            if (error && error.kind === 'stale') return emptyCatalog('stale');
            if (error && error.kind === 'login') return emptyCatalog('login');
            return emptyCatalog('fetch-fail');
        }
        if (requestToken !== catalogToken) {
            scheduler.closeList();
            return emptyCatalog('stale');
        }

        scheduler.closeList();
        logCouponListSummary({
            reason: 'DOM',
            domCount: embedded.records.length,
            extraPages: extra.fetched,
            couponCount: merged.length
        });
        bridge.publishConditions(merged);
        scheduler.hold(false);
        var outcomes = await scheduler.finished();
        return catalogFromOutcomes(merged, outcomes, loginState, requestToken);
    }

    async function buildCatalog(loginState, requestToken) {
        await whenDomReady();
        if (requestToken !== catalogToken) return emptyCatalog('stale');
        var embedded = readEmbeddedCouponList();
        if (embedded.state === 'ready') return completeEmbeddedCatalog(loginState, requestToken, embedded);

        var loaded;
        try {
            loaded = await loadCouponRecords(requestToken);
        } catch (error) {
            if (error && error.kind === 'stale') return emptyCatalog('stale');
            if (error && error.kind === 'login') return emptyCatalog('login');
            return emptyCatalog('fetch-fail');
        }
        if (loaded.status === 'none') {
            logCouponListSummary({
                reason: loaded.reason || '쿠폰 없음',
                domCount: loaded.domCount || 0,
                extraPages: loaded.extraPages || 0,
                couponCount: 0
            });
            publishStandaloneConditions([], requestToken);
            return emptyCatalog('none');
        }
        if (loaded.status === 'login') return emptyCatalog('login');

        var records = loaded.records;

        var nowMs = Date.now();
        var parsed = mergeCouponCandidates(records.map(function (tbody) {
            return readCouponCandidate(tbody, nowMs);
        }));
        logCouponListSummary({
            reason: loaded.reason || '',
            domCount: loaded.domCount || 0,
            extraPages: loaded.extraPages || 0,
            couponCount: parsed.length
        });
        if (!parsed.length) {
            publishStandaloneConditions([], requestToken);
            return emptyCatalog('no-match');
        }

        var scheduler = createProductWorkQueue(requestToken);
        var bridge = openDetailBridge(scheduler, requestToken);
        scheduler.hold(true);
        for (var i = 0; i < parsed.length; i++) scheduler.enqueue(parsed[i]);
        bridge.publishConditions(parsed);
        scheduler.closeList();
        scheduler.hold(false);
        var outcomes = await scheduler.finished();
        return catalogFromOutcomes(parsed, outcomes, loginState, requestToken);
    }

    function sameKnownLoginState(left, right) {
        return left !== 'unknown' && right !== 'unknown' && left === right;
    }

    function loadCatalog() {
        var stateNow = readLoginState();
        if (catalogPromise && catalogKey && catalogKey !== 'pending' && sameKnownLoginState(catalogKey, stateNow)) {
            console.info('[OWNED_COUPON][CATALOG]', { event: '기존 조회 공유', run: catalogRun, loginState: stateNow });
            return catalogPromise;
        }
        if (catalogPromise && catalogKey === 'pending') {
            console.info('[OWNED_COUPON][CATALOG]', { event: '진행 중 조회 공유', run: catalogRun });
            return catalogPromise;
        }
        if (catalogPromise && catalogKey === 'unknown' && stateNow === 'unknown') {
            console.info('[OWNED_COUPON][CATALOG]', { event: '기존 조회 공유', run: catalogRun, loginState: 'unknown' });
            return catalogPromise;
        }

        catalogRun += 1;
        var run = catalogRun;
        var requestToken = ++catalogToken;
        catalogKey = 'pending';
        productCache = new Map();
        productInflight = new Map();
        var textLengthAtStart = 0;
        console.info('[OWNED_COUPON][CATALOG]', { event: '조회 시작', run: run, productConcurrency: FETCH_CONCURRENCY });

        var promise = whenLoginStateKnown().then(function (loginState) {
            if (requestToken !== catalogToken) return emptyCatalog('stale');
            catalogKey = loginState;
            textLengthAtStart = loginState === 'logged-in' ? logonTextLength() : 0;
            noteLoginState(loginState);
            console.info('[OWNED_COUPON][CATALOG]', { event: '로그인 상태 확정', run: run, loginState: loginState });
            return buildCatalog(loginState, requestToken);
        }).then(function (result) {
            if (requestToken !== catalogToken) return emptyCatalog('stale');
            var nowState = readLoginState();
            if (catalogKey === 'logged-in' && nowState === 'logged-in') {
                var nowLength = logonTextLength();
                if (nowLength !== textLengthAtStart) {
                    console.info('[OWNED_COUPON][CATALOG]', {
                        event: '로그인 문구 변화 무시',
                        run: run,
                        loginState: 'logged-in',
                        textLengthBefore: textLengthAtStart,
                        textLengthAfter: nowLength
                    });
                }
            }
            if (nowState !== 'unknown' && catalogKey !== 'unknown' && catalogKey !== 'pending' && nowState !== catalogKey) {
                console.info('[OWNED_COUPON][CATALOG]', {
                    event: '조회 무효',
                    reason: '로그인 상태 전환',
                    run: run,
                    loginState: nowState
                });
                return logCatalogCompleted(requestToken, emptyCatalog('stale'));
            }
            return logCatalogCompleted(requestToken, result);
        }).catch(function () {
            if (requestToken !== catalogToken) return emptyCatalog('stale');
            return logCatalogCompleted(requestToken, emptyCatalog('fetch-fail'));
        });

        catalogPromise = promise;
        return promise;
    }

    function watchLoginState() {
        if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
        var root = document.documentElement;
        if (!root) return;
        new MutationObserver(function () {
            noteLoginState(readLoginState(), '로그인 상태 전환');
        }).observe(root, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ['class']
        });
    }

    watchLoginState();

    window.GcOwnedCoupon = {
        recoveryMs: RECOVERY_MS,
        readLoginState: readLoginState,
        reset: reset,
        loadCatalog: loadCatalog,
        watchProductDiscount: watchProductDiscount,
        reevaluateProductDiscount: reevaluateProductDiscount,
        noteDetailPriceConfirmed: noteDetailPriceConfirmed,
        selectLargest: selectLargest,
        salePercent: salePercent,
        formatWon: formatWon,
        productNoFromHref: productNoFromHref
    };
})();
