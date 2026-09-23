(function () {
    'use strict';

    var JQUERY_WAIT_INTERVAL = 50;
    var JQUERY_WAIT_MAX_TRY = 100;
    var SALE_PERCENT_DEBOUNCE = 100;

    waitForJQuery(init);

    function waitForJQuery(callback, tryCount) {
        var currentTry = tryCount || 0;

        if (window.jQuery) {
            callback(window.jQuery);
            return;
        }

        if (currentTry >= JQUERY_WAIT_MAX_TRY) {
            console.error('[SALE_PERCENT] jQuery 로드 타임아웃 - 할인율 표시 기능 비활성화');
            return;
        }

        window.setTimeout(function () {
            waitForJQuery(callback, currentTry + 1);
        }, JQUERY_WAIT_INTERVAL);
    }

    function init($) {
        $(function () {
            initSalePercent($);
        });
    }

    function initSalePercent($) {
        /* =====================================================
           가격 텍스트 파싱
        ===================================================== */
        function extractPriceText($li) {
            if (!$li || !$li.length) return '';

            var text = '';

            $li.contents().each(function () {
                var node = this;

                if (node.nodeType === 3) {
                    text += node.nodeValue || '';
                }

                if (node.nodeType === 1) {
                    var $node = $(node);

                    if (
                        $node.hasClass('percent-text') ||
                        $node.hasClass('sale_box') ||
                        $node.hasClass('discount-rate') ||
                        $node.hasClass('title') ||
                        $node.attr('id') === 'span_product_tax_type_text'
                    ) {
                        return;
                    }

                    text += $node.text();
                }
            });

            return $.trim(text);
        }

        function numFromPriceLi($li) {
            var s = extractPriceText($li).replace(/\([^)]*\)/g, '');
            var m = s.match(/([0-9][0-9,]*)/);
            return m ? parseInt(m[1].replace(/,/g, ''), 10) : NaN;
        }

        function getPriceLi($spec, keyword) {
            return $spec.find('> li').filter(function () {
                var text = $(this).text().replace(/\s+/g, '');
                return text.indexOf(keyword.replace(/\s+/g, '')) > -1;
            }).first();
        }

        function isValidPrice(price) {
            return isFinite(price) && price > 0;
        }

        function getPriceInsertTarget($li) {
            var $target = $li.children('span').filter(function () {
                var $span = $(this);
                if ($span.attr('id') === 'span_product_tax_type_text') return false;
                return /[0-9][0-9,]*원?/.test($.trim($span.text()));
            }).first();

            return $target.length ? $target : $li;
        }

        /* =====================================================
           할인율 뱃지
        ===================================================== */
        function removePercent($card) {
            $card.find('.percent-text').remove();
            $card.removeData('salePercent');
        }

        /* =====================================================
           소비자가 표시 여부
        ===================================================== */
        function hideConsumerPrice($liConsumer) {
            if (!$liConsumer.length) return;
            $liConsumer.css('display', 'none');
        }

        function showConsumerPrice($liConsumer) {
            if (!$liConsumer.length) return;
            $liConsumer.css('display', '');
        }

        function updateConsumerPriceVisibility($liConsumer, consumer, sell) {
            var isSamePrice = isValidPrice(consumer) && isValidPrice(sell) && consumer === sell;

            if (isSamePrice) {
                hideConsumerPrice($liConsumer);
            } else {
                showConsumerPrice($liConsumer);
            }
        }

        function clearSalePercent($card, $liConsumer, consumer, sell) {
            removePercent($card);
            updateConsumerPriceVisibility($liConsumer, consumer, sell);
        }

        function applySalePercent($targets) {
            $targets.each(function () {
                var $card = $(this);
                var $spec = $card.find('ul.spec').first();
                if (!$spec.length) return;

                var $liConsumer = getPriceLi($spec, '소비자가');
                var $liBasic = getPriceLi($spec, '판매가');
                var $liSale = getPriceLi($spec, '최적할인가');

                var consumer = $liConsumer.length ? numFromPriceLi($liConsumer) : NaN;
                var sell = $liBasic.length ? numFromPriceLi($liBasic) : NaN;
                var best = $liSale.length ? numFromPriceLi($liSale) : NaN;

                var finalPrice = NaN, basePrice = NaN, $targetLi = $();

                if ($liSale.length && isValidPrice(best)) {
                    finalPrice = best;
                    $targetLi = $liSale;
                } else if (isValidPrice(sell)) {
                    finalPrice = sell;
                    $targetLi = $liBasic;
                } else {
                    clearSalePercent($card, $liConsumer, consumer, sell);
                    return;
                }

                if (isValidPrice(consumer) && consumer > finalPrice) {
                    basePrice = consumer;
                } else if (isValidPrice(sell) && sell > finalPrice) {
                    basePrice = sell;
                } else {
                    clearSalePercent($card, $liConsumer, consumer, sell);
                    return;
                }

                var pct = Math.round(100 - (finalPrice * 100) / basePrice);
                if (!(pct > 0)) {
                    clearSalePercent($card, $liConsumer, consumer, sell);
                    return;
                }

                var $percentEl = $card.find('.percent-text').first();
                var prevPct = $card.data('salePercent');

                if (!$percentEl.length) {
                    $percentEl = $('<span class="percent-text"><span class="sale-num"></span></span>');
                    var $insertTarget = getPriceInsertTarget($targetLi);
                    $percentEl.insertBefore($insertTarget);
                }

                if (prevPct !== pct) {
                    $percentEl.find('.sale-num').html(pct + '<span class="percent-sign">%</span>');
                    $card.data('salePercent', pct);
                }

                updateConsumerPriceVisibility($liConsumer, consumer, sell);
            });
        }

        /* =====================================================
           상품 상세 할인율
           detail.js에서 부여한 가격 행 클래스 또는 관리자 항목명을 사용합니다.
        ===================================================== */
        function applyDetailSalePercent() {
            var $design = $('.xans-product-detaildesign').first();
            if (!$design.length) return;

            function findRow(className, labels) {
                var $row = $design.find('tr.' + className).first();
                if ($row.length) return $row;

                return $design.find('tr').filter(function () {
                    var label = $.trim($(this).find('th').first().text());
                    return labels.indexOf(label) > -1;
                }).first();
            }

            function priceFromRow($row) {
                if (!$row.length) return NaN;
                var $priceCell = $row.find('td').first().clone();
                $priceCell.find('.discount-rate, .percent-text').remove();
                var match = $priceCell.text().match(/([0-9][0-9,]*)/);
                return match ? parseInt(match[1].replace(/,/g, ''), 10) : NaN;
            }

            var $consumerRow = findRow('prd-consumer-price', ['소비자가', '정가']);
            var $saleRow = findRow('prd-sale-price', ['판매가', '구매가']);
            var consumer = priceFromRow($consumerRow);
            var sale = priceFromRow($saleRow);
            var $saleCell = $saleRow.find('td').first();
            var $existingRate = $saleCell.find('.discount-rate').first();

            if (!isValidPrice(consumer) || !isValidPrice(sale) || consumer <= sale) {
                if ($existingRate.length) $existingRate.remove();
                return;
            }

            var percent = Math.round(100 - (sale * 100) / consumer);
            if (percent <= 0) return;

            if ($existingRate.length && $.trim($existingRate.text()) === percent + '%') return;
            $existingRate.remove();

            $('<strong class="discount-rate"></strong>')
                .text(percent + '%')
                .prependTo($saleCell);
        }

        function runSalePercent() {
            applySalePercent($('.prdList__item'));
            applyDetailSalePercent();
        }

        runSalePercent();

        var timer = null;
        function scheduleRun() {
            clearTimeout(timer);
            timer = setTimeout(runSalePercent, SALE_PERCENT_DEBOUNCE);
        }

        var observer = new MutationObserver(scheduleRun);
        observer.observe(document.body, { childList: true, subtree: true });
    }
})();
