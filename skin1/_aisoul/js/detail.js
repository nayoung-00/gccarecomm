(function () {
    'use strict';

    window.__detailJsBootCount = (window.__detailJsBootCount || 0) + 1;
    if (window.__detailJsBootCount > 1) return;
    /**
     * 상품상세 커스텀 JS
     *
     * - 상품정보 테이블 클래스
     * - 상품요약정보 칩
     * - 상품 이미지 드래그
     * - 상품 상세 팝업
     * - 상세설명 펼쳐보기
     * - 상품정보고시
     * - Q&A
     * - 하단 고정 구매바 / 옵션 바텀시트
     * - 상세 탭 스크롤
     *
     * [상품정보고시]
     * - health : 건강기능식품
     * - food : 일반식품
     * - NOTICE_FIELDS : 유형별 노출 항목
     * - NOTICE_FIELD_ALIASES : 외부 데이터 필드명 매핑
     *
     * [임시 건기식 분기]
     * - isDemoHealthProduct() : 임시 상품 판별
     * - 고시 fallback / 네이버페이 혜택 : 현재 데모 상품만 노출
     * - 실제 데이터 연동 시 임시 상품명 분기 제거 필요
     *
     * [구매 바텀시트]
     * - Cafe24 원본 옵션 / 수량 / 가격 / 구매 기능 사용
     * - 단일상품 : 기본 상품 행 사용
     * - 옵션상품 : option_product / add_product 사용
     * - 옵션 미선택 : 0원 / 0개
     * - 단일상품 금액 : #totalPrice 기준
     * - Cafe24 옵션 DOM 갱신 후 시트 재생성
     * - 모바일 필수 옵션 미선택 시 Cafe24 기본 옵션 레이어 대신 PC와 동일하게 알럿 노출
     * (initFixedPurchase > hasRequiredOptionSelected / requiredOptionGuardBound)
     *
     */

    /**
     * [업데이트]
     * 260814 :: 상태칩 1차 -> 보류(initSummaryChips 주석)
     * 
     */


    const JQUERY_WAIT_INTERVAL = 50;
    const JQUERY_WAIT_MAX_TRY = 100;
    // var SUMMARY_CHIP_COLOR_COUNT = 5;
    const DETAIL_TAB_SCROLL_OFFSET = 60;
    const SCROLL_SPY_ANIMATION_GUARD_MS = 500;
    const REQUIRED_OPTION_ALERT_MESSAGE = '옵션을 선택해 주세요.';
    // 임시 건기식 시안 확인용: 실제 Cafe24 고시 데이터/건기식 분기 연동 후 삭제
    // var DEMO_HEALTH_PRODUCT_NAME =
    //     'gc녹십자웰빙pnt액상-마그네슘-플러스-20ml-x-30포-x-1박스1개월분-망고맛-저당설계';

    const PRODUCT_NOTICE_EMPTY_CODES = [
        'PRODUCT_INFORMATION_TYPE_MISSING',
        'PRODUCT_INFORMATION_INVALID'
    ];

    let productNoticeApiRequested = false;
    let relatedProductsApiRequested = false;

    // 가격 행 라벨 교체 — 리워드 상품: 판매가 → 최대할인가 / 최적할인가 상품: 최적할인가 → 쿠폰 적용가
    const SALE_PRICE_MEMBER_LABEL = '최대 할인가';
    const SALE_PRICE_LABEL_PATTERN = /최대할인가|판매가|구매가/;
    const BEST_DISCOUNT_COUPON_LABEL = '쿠폰 적용가';
    const BEST_DISCOUNT_LABEL_PATTERN = /최적할인가|최대 혜택가/;

    // 리워드 상품 여부 — 'pending'(API 응답 전) | 'reward' | 'none'
    let rewardProductState = 'pending';
    let detailQuery = null;
    let productNoticeRequestId = 0;
    let rewardNoticeReady = false;
    let rewardBenefitAmount = 0;
    let couponPriceReady = false;

    const PRODUCT_INFO_LABEL_CLASS_MAP = {
        '상품명': 'prd-name',
        '상품요약정보': 'prd-summary',
        '소비자가': 'prd-consumer-price',
        '정가': 'prd-consumer-price',
        '판매가': 'prd-sale-price',
        '구매가': 'prd-sale-price',
        '배송비': 'prd-delivery-fee',    
        '최적할인가': 'prd-best-discount-price',
        '최대 혜택가': 'prd-best-discount-price',
        '할인 기간': 'prd-discount-period'   
    };

    /* 툴팁 문구 모음 — getTooltipHtml('키')로 꺼내 씀
       label: 버튼 aria-label(스크린리더용), text: 툴팁 내용 */
    const TOOLTIPS = {
        memberPrice: {
            label: '어떠케어 회원 특별가 안내',
            text: '어떠케어 회원이면 별도 조건 없이 적용됩니다.'
        },
        npayBenefit: {
            label: '네이버페이 혜택 안내',
            text: '구매 수량 및 참여 횟수에 따라 지급되는 리워드 금액 상이'
        },
        bestDiscount: {
            label: '최대 혜택가 안내',
            text: '결제는 구매가로 진행되며, 최대 리워드 지급 시의 최종 혜택가2'
        }
    };

    // 가격표 행 클래스 → 자동으로 붙일 툴팁 키 (initPriceRows에서 사용)
    const PRICE_ROW_TOOLTIPS = {
        'prd-best-discount-price': 'bestDiscount'
    };

    function getTooltipHtml(key) {
        const tooltip = TOOLTIPS[key];
        if (!tooltip) return '';

        return '<span class="price-tooltip">' +
            '<button type="button" class="price-tooltip-trigger" aria-label="' + tooltip.label + '"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13.5724 8.00002C13.5724 11.077 11.078 13.5714 8.00099 13.5714C4.92398 13.5714 2.42957 11.077 2.42957 8.00002C2.42957 4.923 4.92398 2.42859 8.00099 2.42859C11.078 2.42859 13.5724 4.923 13.5724 8.00002Z" stroke-width="0.857143" stroke-linecap="round" stroke-linejoin="round" stroke="#2A2A2A"/><path d="M6.71484 6.7143C6.71484 6.46001 6.79025 6.21143 6.93153 6C7.0728 5.78856 7.2736 5.62377 7.50854 5.52646C7.74347 5.42915 8.00198 5.40368 8.25139 5.45329C8.50079 5.5029 8.72989 5.62536 8.9097 5.80517C9.08951 5.98498 9.21196 6.21407 9.26157 6.46347C9.31118 6.71288 9.28572 6.97139 9.1884 7.20633C9.09109 7.44126 8.9263 7.64206 8.71486 7.78334C8.50343 7.92461 8.25485 8.00002 8.00056 8.00002V8.85716" stroke-width="0.857143" stroke-linecap="round" stroke-linejoin="round" stroke="#2A2A2A"/><path d="M8.00335 11C7.885 11 7.78906 10.904 7.78906 10.7857C7.78906 10.6674 7.885 10.5714 8.00335 10.5714" stroke-width="0.857143" stroke-linecap="round" stroke-linejoin="round" stroke="#2A2A2A"/><path d="M8 11C8.11835 11 8.21429 10.904 8.21429 10.7857C8.21429 10.6674 8.11835 10.5714 8 10.5714" stroke-width="0.857143" stroke-linecap="round" stroke-linejoin="round" stroke="#2A2A2A"/></svg></button>' +
            '<span class="price-tooltip-panel" role="tooltip">' + tooltip.text + '</span>' +
            '</span>';
    }

    // 상품정보고시 설정
    const NOTICE_COMMON_FIELDS = {
        productName: { key: 'productName', label: '제품명' },
        origin: { key: 'origin', label: '소재지' },
        content: { key: 'content', label: '내용량·수량' },
        packageUnit: { key: 'packageUnit', label: '포장 단위별 수량' },
        importReport: { key: 'importReport', label: '수입신고 여부' },
        customerService: { key: 'customerService', label: '소비자상담 전화번호' },
        safetyWarning: { key: 'safetyWarning', label: '소비자안전 주의사항' }
    }

    const NOTICE_FIELDS = {
        health: [
            NOTICE_COMMON_FIELDS.productName,
            { key: 'manufacturer', label: '제조업소' },
            NOTICE_COMMON_FIELDS.origin,
            { key: 'expiration', label: '소비기한' },
            { key: 'storage', label: '보관방법' },
            NOTICE_COMMON_FIELDS.content,
            NOTICE_COMMON_FIELDS.packageUnit,
            { key: 'ingredients', label: '원료명 및 함량' },
            { key: 'nutrition', label: '영양정보' },
            { key: 'functionInfo', label: '기능정보' },
            { key: 'intake', label: '섭취량·방법·주의사항' },
            { key: 'medicine', label: '의약품 여부' },
            { key: 'gmoHealth', label: '유전자변형건강기능식품 여부' },
            NOTICE_COMMON_FIELDS.importReport,
            NOTICE_COMMON_FIELDS.safetyWarning,
            NOTICE_COMMON_FIELDS.customerService,
        ],
        food: [
             NOTICE_COMMON_FIELDS.productName,
            { key: 'foodType', label: '식품의 유형' },
            { key: 'manufacturer', label: '생산자' },
            NOTICE_COMMON_FIELDS.origin,
            { key: 'manufactureDate', label: '제조연월일' },
            { key: 'expiration', label: '소비기한 또는 품질유지기한' },
            NOTICE_COMMON_FIELDS.content,
            NOTICE_COMMON_FIELDS.packageUnit,
            { key: 'ingredients', label: '원재료명 및 함량' },
            { key: 'nutrition', label: '영양성분' },
            { key: 'gmo', label: '유전자변형식품 여부' },
            NOTICE_COMMON_FIELDS.safetyWarning,
            NOTICE_COMMON_FIELDS.importReport,
            NOTICE_COMMON_FIELDS.customerService,
        ]
    };

    /* 상품정보고시 API → 프론트 필드 매핑 */
    // 공통 6개 반환
    const NOTICE_COMMON_API_MAP = {
        productName: 'productName', // 제품명
        origin: 'location', // 소재지
        content: 'contentAndQuantity', // 내용량·수량
        packageUnit: 'quantityPerPackageUnit', // 포장 단위별 수량
        importReport: 'importDeclarationStatus', // 수입신고 여부
        customerService: 'consumerConsultationPhoneNumber', // 소비자상담 전화번호
        safetyWarning: 'consumerSafetyPrecautions' // 소비자안전 주의사항
    };

    // 건기식 9개 반환
    const NOTICE_HEALTH_API_MAP = {
        manufacturer: 'manufacturer', // 제조업소
        expiration: 'expirationDate', // 소비기한
        storage: 'storageMethod', // 보관방법
        ingredients: 'ingredientsAndAmounts', // 원료명 및 함량
        nutrition: 'nutritionInformation', // 영양정보
        functionInfo: 'functionalInformation', // 기능정보
        intake: 'intakeMethodAndPrecautions', // 섭취량·방법·주의사항
        medicine: 'pharmaceuticalStatus', // 의약품 여부
        gmoHealth: 'geneticallyModifiedHealthFunctionalFoodStatus', // 유전자변형건강기능식품 여부
    }
    
    // 일반식 7개 반환
    const NOTICE_FOOD_API_MAP = {
        foodType: 'foodType', // 식품의 유형
        manufacturer: 'producer', // 생산자
        manufactureDate: 'manufacturingDate', // 제조연월일
        expiration: 'expirationOrQualityRetentionPeriod', // 소비기한 또는 품질유지기한
        ingredients: 'ingredientsAndAmounts', // 원재료명 및 함량
        nutrition: 'nutritionFacts', // 영양성분
        gmo: 'geneticallyModifiedFoodStatus', // 유전자변형식품 여부
    }

    function getProductNoticeApiBaseUrl() {
        const host = location.hostname;
        if (host === 'gccarecomm.cafe24.com') return 'https://cafe24.howcare.co.kr/api/products';
        if (host === 'gccarecommstg.cafe24.com') return 'https://stg-cafe24.howcare.co.kr/api/products';
        return '';
    }

    // ===== 상품정보고시 =====
    function mapProductNoticeApiData(apiData) {
        if (!apiData || !apiData.information) return null;

        let type;

        if (apiData.productType === 'HEALTH_FUNCTIONAL_FOOD') {
            type = 'health';
        } else if (apiData.productType === 'GENERAL_FOOD') {
            type = 'food';
        } else {
            return null;
        }

        const information = apiData.information;

        const apiMap = Object.assign(
            {},
            NOTICE_COMMON_API_MAP,
            type === 'health'
                ? NOTICE_HEALTH_API_MAP
                : NOTICE_FOOD_API_MAP
        );

        const result = {
            type: type
        };

        Object.keys(apiMap).forEach(function (fieldKey) {
            const apiKey = apiMap[fieldKey];

            result[fieldKey] = information[apiKey];
        });

        return result;
    }


    waitForJQuery(init);

    function waitForJQuery(callback, tryCount) {
        const currentTry = tryCount || 0;

        if (window.jQuery) {
            callback(window.jQuery);
            return;
        }

        if (currentTry >= JQUERY_WAIT_MAX_TRY) {
            console.error('[DETAIL] jQuery 로드 타임아웃 - 상품상세 커스텀 기능 비활성화');
            return;
        }

        window.setTimeout(function () {
            waitForJQuery(callback, currentTry + 1);
        }, JQUERY_WAIT_INTERVAL);
    }

    function runAtDelays(fn, delays) {
        delays.forEach(function (delay) {
            window.setTimeout(fn, delay);
        });
    }


    function init($) {
        detailQuery = $;
        $(function () {
            initBestReview();
            initReviewAllButton($);
            initProductInfoTable($);
            initPriceRows($);
            initDiscountBreakdown($);
            // To-Be 케이스 쿠폰보유자 및 미보유자
            initOwnedCouponEstimate($);
            loadProductNotice($);
            loadRelatedProducts();
            initServiceInfo();
            // initProductNotice();
            //   initSummaryChips($);
            initDetailLayout($);
            initDetailPopup();
            initProductImageDrag($);
            // initNaverPayBenefit($);
            runAtDelays(function () {
                initPriceUnitWrap($);
            }, [0, 250, 700, 1500]);
            initFixedPurchase($);
            initProductDetailMore($);
            initQnaList($);
            initDetailTabScroll($);
            initDetailSkeleton($);
            initAddProductToggle($);
        });
    }

    /* 추천 조합 열기/닫기 화살표 */
    function initAddProductToggle($) {
        $('.xans-product-detail .productSet.additional').each(function () {
            const $wrap = $(this);
            const $list = $wrap.children('.product');
            const $toggle = $wrap.find('> .title .toggle');
            if (!$list.length || !$toggle.length) return;

            function setClosed(closed) {
                $wrap.toggleClass('is-closed', closed);
                $toggle.attr('aria-expanded', String(!closed));
                $toggle.contents().filter(function () {
                    return this.nodeType === 3 && $.trim(this.nodeValue);
                }).each(function () {
                    this.nodeValue = closed ? '추가구성상품 열기' : '추가구성상품 닫기';
                });
            }

            function sync() {
                if ($list.is(':animated')) return;
                setClosed($list.css('display') === 'none');
            }

            sync();

            // 클릭 즉시 화살표 회전
            $toggle.on('click.addProductArrow', function () {
                setClosed(!$wrap.hasClass('is-closed'));
            });

            // 기본 스크립트가 style을 바꾸면 실제 상태로 다시 맞춤
            if (window.MutationObserver) {
                new MutationObserver(function () {
                    setTimeout(sync, 0);
                }).observe($list[0], { attributes: true, attributeFilter: ['style', 'class'] });
            }
        });
    }

    /* 모바일 첫 화면 스켈레톤 */
    function initDetailSkeleton($) {
        const FALLBACK_TIMEOUT_MS = 2500;
        const $skeleton = $('.product-detail-skeleton').first();
        if (!$skeleton.length) return;

        let hidden = false;
        let fallbackTimer = null;

        const $prdDetailImgEl = $('#prdDetailImg');
        let $mainImage = $prdDetailImgEl.is('img') ? $prdDetailImgEl : $prdDetailImgEl.find('img').first();
        if (!$mainImage.length) {
            $mainImage = $('.xans-product-detail .imgArea .RW .prdImg .thumbnail img').first();
        }

        function hideSkeleton() {
            if (hidden) return;
            hidden = true;
            window.clearTimeout(fallbackTimer);
            if ($mainImage.length) {
                $mainImage.off('load.detailSkeleton error.detailSkeleton');
            }
            $skeleton.addClass('is-hidden');
        }
 
        fallbackTimer = window.setTimeout(hideSkeleton, FALLBACK_TIMEOUT_MS);

        if (!$mainImage.length) return;

        if ($mainImage[0].complete) {
            hideSkeleton();
            return;
        }

        $mainImage.off('load.detailSkeleton error.detailSkeleton')
            .on('load.detailSkeleton error.detailSkeleton', hideSkeleton);
    }

    /* 알파리뷰 - 리뷰 개수에 따른 전체보기/게시물 없음 처리 */
    function initReviewAllButton($) {
        const reviewCountSelector = '#tabProduct a[href="#prdReview"] .alpha_review_count';
        const $reviewContents = $('#prdReview').find('.contents').first();
        const $allButton = $('#prdReview').find('.btnNormalFix.fixed-btn-outline');

        function updateReviewState() {
            const $reviewCount = $(reviewCountSelector).first();
            const countText = $reviewCount
                .text()
                .replace(/[^0-9]/g, '');

            // 아직 리뷰 개수가 출력되지 않은 경우 대기
            if (!$reviewCount.length || countText === '') {
                return;
            }

            const reviewCount = parseInt(countText, 10);

            if (reviewCount > 0) {
                // 리뷰 1개 이상: 전체보기 버튼 노출
                $allButton.removeClass('displaynone');
                $reviewContents.find('.no-data').remove();
            } else {
                // 리뷰 0개: 전체보기 버튼 숨김
                $allButton.addClass('displaynone');

                // 게시물 없음 문구 중복 생성 방지
                if (!$reviewContents.find('.no-data').length) {
                    $reviewContents.append(
                        '<p class="no-data">게시물이 없습니다</p>'
                    );
                }
            }

        }

        updateReviewState();

        const tabProduct = document.querySelector('#tabProduct');

        if (tabProduct) {
            const observer = new MutationObserver(function () {
                updateReviewState();
            });

            observer.observe(tabProduct, {
                childList: true,
                characterData: true,
                subtree: true
            });
        }
    }


    /* 알파리뷰 베스트리뷰 - 모바일에서도 태블릿 데이터 개수 유지 */
    function initBestReview() {
        let lastProvider = null;

        function applyBestReviewOverride() {
            const widget = document.querySelector('review-best-widget');



            if (!widget || !widget.provider) return;

            const provider = widget.provider;

            // provider가 새로 생성된 경우에만 다시 패치
            if (provider === lastProvider && provider.__tabletMobileApplied) {
                return;
            }

            lastProvider = provider;
            provider.__tabletMobileApplied = true;

            /*
            * 알파리뷰 원본:
            *
            * mobile → pageUnit 1
            * tablet/pc → num_col
            *
            * 모바일도 관리자 num_col 값을 사용하도록 변경
            */
            provider.options.getPageUnitOverride = function (deviceKind, designOption) {
                return designOption.num_col;
            };

            /*
            * 모바일에서도 2개 데이터를 담을 수 있도록 grid 유지
            */
            provider.options.setGridSizeOverride = function (deviceKind, designOption) {
                return {
                    row: 1,
                    col: designOption.num_col,
                    gap: deviceKind === 'mobile' ? 16 : 20
                };
            };

            /*
            * ResizeManager가 initializeWidget()을 다시 호출해도
            * mobile용 device=m / page_size=1로 돌아가지 않도록 처리
            */
            const originalInitializeWidget = provider.initializeWidget.bind(provider);

            provider.initializeWidget = function () {
                originalInitializeWidget();

                if (this.deviceKind === 'mobile') {
                    this.filterOption.device = 'w';
                    this.filterOption.page_size = this.designOption.num_col;
                }
            };

            // 현재 상태도 새 설정으로 다시 계산
            provider.setGridSize();
            provider.initializeWidget();

            provider.getReviewMeta()
                .then(function () {
                    provider.getReviewList();
                    return provider.requestQueue;
                })
                .then(function () {
                    widget.requestUpdate();
                })
                .catch(function (error) {
                    const message = error && error.message
                        ? String(error.message)
                        : String(error || '');
                
                    // 베스트 리뷰가 없는 상품은 정상 케이스로 처리
                    if (message.indexOf('RESULT_EMPTY_HIDE') !== -1) {
                        return;
                    }
                
                    // 그 외 실제 오류만 에러로 출력
                    console.error(
                        '[AlphaReview] mobile data override error:',
                        error
                    );
                });
        }

        // 알파리뷰는 늦게 생성되므로 provider 생성 대기
        window.setInterval(applyBestReviewOverride, 500);
    }



    function getProductNo(){
        if(window.iProductNo != null && String(window.iProductNo).trim() != ''){
            return String(window.iProductNo).trim();
        }

        if(typeof getQueryString === 'function'){
            if (queryProductNo) {
                return String(queryProductNo).trim();
            }

        }

        return '';
    }

    function loadProductNotice($) {
        const productNo = getProductNo();
        if (!productNo) {
            console.warn('[DETAIL][PRODUCT_NOTICE] productNo is empty');
            settleRewardNotice($, 0);
            return;
        }

        const apiBaseUrl = getProductNoticeApiBaseUrl();
        if (!apiBaseUrl) {
            settleRewardNotice($, 0);
            return;
        }

        const requestId = ++productNoticeRequestId;
        productNoticeApiRequested = true;

        const requestUrl = apiBaseUrl + '/' + encodeURIComponent(productNo) + '/information-notice';
  
  
        fetch(requestUrl, {})
            .then(function (res) {
                return res.text().then(function (text) {
                    let body = text;
                    try {
                        body = text ? JSON.parse(text) : null;
                    } catch (parseError) {
                        // JSON이 아니면 원문 문자열을 그대로 출력
                    }
  
                    if (!isCurrentProductNotice(requestId, productNo)) return;

                    if (res.ok) {
                        
                        const data = mapProductNoticeApiData(body);
  
                        // 1. 상품 정보 고시
                        if (data && NOTICE_FIELDS[data.type]){
                          const notice = document.getElementById('productNotice');
  
                          if (notice) {
                              renderProductNotice(notice, data);
                              initProductNoticeToggle(notice);
                              notice.hidden = false;
                          }
                        }
                        
                        // 2. 의학 고지
                        if(body && body.information){
                          renderMedicalNotice(body.information.medicalNotice);
                        }
  
                        // 3. 네이버페이  
                        const naverPayPaybackAmount = body ? body.naverPayPaybackAmount : null;
                        settleRewardNotice($, naverPayPaybackAmount);
  
                        return;
                    }
  
                    // 상품정보고시 미등록 → 정상 케이스
                    if(res.status === 422 && 
                        body && 
                        PRODUCT_NOTICE_EMPTY_CODES.indexOf(body.code) !== -1){
                      console.warn( '[DETAIL][PRODUCT_NOTICE] 상품정보고시 데이터 없음/처리불가:', productNo, body.code);

                      renderMedicalNotice(null);
                      settleRewardNotice($, 0);

                      return;
                    };
  
                    // 예상치 못한 API 오류
                    console.error('[DETAIL][PRODUCT_NOTICE] error response:', body);
                    settleRewardNotice($, 0);
                    
                });
            })
            .catch(function (error) {
                if (!isCurrentProductNotice(requestId, productNo)) return;
                console.error('[DETAIL][PRODUCT_NOTICE] fetch error:', error);
                settleRewardNotice($, 0);
            });
    }

    function isCurrentProductNotice(requestId, productNo) {
        return requestId === productNoticeRequestId &&
            String(productNo) === String(currentDetailProductNo() || '');
    }

    function settleRewardNotice($, naverPayPaybackAmount) {
        rewardNoticeReady = true;
        rewardBenefitAmount = Number(String(naverPayPaybackAmount || '').replace(/[^0-9]/g, '')) || 0;
        paintNaverPayBenefit($);
    }

    /* =====================================================
       관련상품(#prdRelation) — /related-products
    ===================================================== */
    function getRelatedProductNoFromHref(href) {
        if (!href) return '';

        let path = href;
        try {
            path = new URL(href, window.location.origin).pathname;
        } catch (e) {
            // keep href as path fallback
        }

        const seoMatch = String(path).match(/\/product\/(?:[^/]+\/)*(\d+)\/category\//);
        if (seoMatch) return seoMatch[1];

        const queryMatch = String(href).match(/[?&]product_no=(\d+)/);
        return queryMatch ? queryMatch[1] : '';
    }

    function isValidRelatedPrice(value) {
        return typeof value === 'number' && isFinite(value) && value > 0;
    }

    function formatRelatedPrice(value) {
        return Number(value).toLocaleString('ko-KR') + '원';
    }

    function getRelatedDiscountPercent(product) {
        const rateText =
            product && product.discountRate != null
                ? String(product.discountRate).trim()
                : '';

        if (rateText) {
            const parsedRate = parseFloat(rateText.replace(/%/g, ''));
            if (isFinite(parsedRate) && parsedRate > 0) {
                return Math.round(parsedRate);
            }
        }

        if (
            isValidRelatedPrice(product.retailPrice) &&
            isValidRelatedPrice(product.price) &&
            product.retailPrice > product.price
        ) {
            return Math.round(100 - (product.price * 100) / product.retailPrice);
        }

        return 0;
    }

    function parseRelatedPaybackAmount(value) {
        if (typeof value === 'number' && isFinite(value) && value > 0) {
            return Math.round(value);
        }

        if (value == null) return 0;

        const str = String(value).trim();
        if (!str) return 0;

        if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(str)) {
            return 0;
        }

        const parsed = parseInt(str.replace(/,/g, ''), 10);
        return parsed > 0 ? parsed : 0;
    }

    function renderRelatedCashback(description, amount) {
        const parsedAmount = parseRelatedPaybackAmount(amount);
        if (!description) return;

        const existing = description.querySelector('.productCashback');

        if (!parsedAmount) {
            if (existing) existing.remove();
            return;
        }

        const formattedAmount = parsedAmount.toLocaleString('ko-KR');

        if (existing) {
            const amountEl = existing.querySelector('.productCashbackAmount');
            if (amountEl) amountEl.textContent = formattedAmount;
            return;
        }

        description.insertAdjacentHTML(
            'beforeend',
            '<div class="productCashback">' +
                '<svg class="productCashbackIcon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">' +
                    '<path d="M2.50098 4V10C2.50098 11.1 4.50098 12 7.00098 12C9.50098 12 11.501 11.1 11.501 10V4" fill="#92E7BB"></path>' +
                    '<path d="M2.50098 4V10C2.50098 11.1 4.50098 12 7.00098 12C9.50098 12 11.501 11.1 11.501 10V4" stroke="#0AC262" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"></path>' +
                    '<path d="M11.501 7C11.501 8.1 9.50098 9 7.00098 9C4.50098 9 2.50098 8.1 2.50098 7" stroke="#0AC262" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"></path>' +
                    '<path d="M7.00098 5.99805C9.48626 5.99805 11.501 5.10262 11.501 3.99805C11.501 2.89348 9.48626 1.99805 7.00098 1.99805C4.5157 1.99805 2.50098 2.89348 2.50098 3.99805C2.50098 5.10262 4.5157 5.99805 7.00098 5.99805Z" fill="#92E7BB" stroke="#0AC262" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"></path>' +
                '</svg>' +
                '<p class="productCashbackText">' +
                    '리워드 적용 시 <span class="productCashbackAmount">' +
                        formattedAmount +
                    '</span>원' +
                '</p>' +
            '</div>'
        );
    }

    function applyRelatedProductItem(item, product) {
        const description = item.querySelector('.description');
        const priceWrap = item.querySelector('.price');
        if (!description || !priceWrap) return;

        const prodPriceEl = priceWrap.querySelector('.prodPrice');
        const saleNumEl = priceWrap.querySelector('.detailSaleNum');
        const prdPriceEl = priceWrap.querySelector('.prdPrice');
        const retailPrice = product.retailPrice;
        const sellPrice = product.price;

        if (isValidRelatedPrice(sellPrice) && prdPriceEl) {
            prdPriceEl.textContent = formatRelatedPrice(sellPrice);
        }

        if (
            isValidRelatedPrice(retailPrice) &&
            isValidRelatedPrice(sellPrice) &&
            retailPrice > sellPrice
        ) {
            const discountPercent = getRelatedDiscountPercent(product);

            if (prodPriceEl) {
                prodPriceEl.textContent = formatRelatedPrice(retailPrice);
            }
            if (saleNumEl) {
                saleNumEl.textContent =
                    discountPercent > 0 ? discountPercent + '%' : '';
            }
        } else {
            if (prodPriceEl) prodPriceEl.textContent = '';
            if (saleNumEl) saleNumEl.textContent = '';
        }

        renderRelatedCashback(description, product.naverPayPaybackAmount);
    }

    function applyRelatedProducts(relatedProducts) {
        if (!relatedProducts || !relatedProducts.length) return;

        const relationRoot = document.getElementById('prdRelation');
        if (!relationRoot) return;

        const productMap = new Map();
        relatedProducts.forEach(function (product) {
            if (!product || product.productNo == null) return;
            productMap.set(String(product.productNo), product);
        });

        if (!productMap.size) return;

        relationRoot.querySelectorAll('.prdList__item').forEach(function (item) {
            const link = item.querySelector(
                '.thumbnail a[href], .name a[href], a[href]'
            );
            const productNo = getRelatedProductNoFromHref(
                link && link.getAttribute('href')
            );
            if (!productNo) return;

            const product = productMap.get(String(productNo));
            if (!product) return;

            try {
                applyRelatedProductItem(item, product);
            } catch (error) {
                console.warn(
                    '[DETAIL][RELATED_PRODUCTS] apply failed:',
                    productNo,
                    error
                );
            }
        });
    }

    function loadRelatedProducts() {
        if (relatedProductsApiRequested) return;

        const productNo = getProductNo();
        if (!productNo) {
            console.warn('[DETAIL][RELATED_PRODUCTS] productNo is empty');
            return;
        }

        const apiBaseUrl = getProductNoticeApiBaseUrl();
        if (!apiBaseUrl) {
            return;
        }

        relatedProductsApiRequested = true;

        const requestUrl =
            apiBaseUrl +
            '/' +
            encodeURIComponent(productNo) +
            '/related-products';

        fetch(requestUrl, {})
            .then(function (res) {
                return res.text().then(function (text) {
                    let body = null;

                    try {
                        body = text ? JSON.parse(text) : null;
                    } catch (parseError) {
                        body = null;
                    }

                    if (!res.ok) {
                        console.error(
                            '[DETAIL][RELATED_PRODUCTS] error response:',
                            res.status,
                            body
                        );
                        return;
                    }

                    applyRelatedProducts(
                        body && body.relatedProducts
                            ? body.relatedProducts
                            : []
                    );
                });
            })
            .catch(function (error) {
                console.error(
                    '[DETAIL][RELATED_PRODUCTS] fetch error:',
                    error
                );
            });
    }

    function formatNoticeValue(value) {
        return value === null || value === undefined || (typeof value === 'string' && value.trim() === '') ? '-' : String(value);
    }

    // 서비스 문의 / 안내: Cafe24 {$service_info}가 비어 있을 때만 '-' 표시
    function initServiceInfo() {
        const info = document.querySelector('.service-info');

        if (!info) return;

        if (info.textContent.trim() === '') {
            info.textContent = formatNoticeValue('');
        }
    }



    function renderProductNotice(notice, data) {
        const list = notice.querySelector('.product-notice__list');
        if (!list) return;

        list.textContent = '';
        NOTICE_FIELDS[data.type].forEach(function (field) {
            const item = document.createElement('div');
            const term = document.createElement('dt');
            const description = document.createElement('dd');

            item.className = 'product-notice__item';
            term.textContent = field.label;
            description.textContent = formatNoticeValue(data[field.key]);
            item.appendChild(term);
            item.appendChild(description);
            list.appendChild(item);
        });
    }

    // 의학 고지
    function renderMedicalNotice(medicalNotice) {
        const medicalNoticeSection =
            document.querySelector('.medical-notice');

        if (!medicalNoticeSection) return;

        const info = medicalNoticeSection.querySelector(
            '.info[data-contents="medical"]'
        );

        if (!info) return;

        info.textContent = formatNoticeValue(medicalNotice);
        medicalNoticeSection.hidden = false;
    }



    function initProductNoticeToggle(notice) {
        const button = notice.querySelector('.product-notice__toggle');
        const label = button && button.querySelector('span');
        if (!button || !label) return;

        notice.classList.add('is-collapsed');
        button.setAttribute('aria-expanded', 'false');
        label.textContent = '상품정보 펼쳐보기';

        if (button.dataset.noticeToggleBound === 'true') return;

        button.dataset.noticeToggleBound = 'true';
        button.addEventListener('click', function () {
            const isCollapsed = notice.classList.toggle('is-collapsed');
            button.setAttribute('aria-expanded', String(!isCollapsed));
            label.textContent = isCollapsed ? '상품정보 펼쳐보기' : '상품정보 접기';
        });
    }

    /* 상세설명 펼쳐보기 버튼 */
    function initProductDetailMore($) {
        const LIMIT_HEIGHT = 1000;
        const $detail = $('#prdDetail .prd-detail-content').first();
        const $buttonWrap = $('#prdDetail .prd-detail-more-wrap').first();
        const $button = $buttonWrap.find('.prd-detail-more-btn').first();
        if (!$detail.length || !$buttonWrap.length || !$button.length) return;

        function getRealHeight() {
            let height = Math.max($detail[0].scrollHeight, $detail.outerHeight() || 0);
            $detail.find('img').each(function () {
                height = Math.max(height, this.naturalHeight || 0);
            });
            return height;
        }

        function setup() {
            if ($detail.data('expanded')) return;
            $detail.css({ maxHeight: 'none', overflow: 'visible' });

            if (getRealHeight() <= LIMIT_HEIGHT) {
                $buttonWrap.removeClass('is-visible').hide();
                return;
            }

            $detail.css({ maxHeight: LIMIT_HEIGHT + 'px', overflow: 'hidden' });
            $buttonWrap.addClass('is-visible').show();
        }

        $button.off('click.prdDetailMore').on('click.prdDetailMore', function () {
            $detail.data('expanded', true).css({ maxHeight: 'none', overflow: 'visible' });
            $button.attr('aria-expanded', 'true');
            $buttonWrap.removeClass('is-visible').hide();
        });

        $detail.find('img').each(function () {
            if (!this.complete) $(this).off('load.prdDetailMore').one('load.prdDetailMore', setup);
        });
        runAtDelays(setup, [0, 250, 700, 1500]);
    }

    /* Q&A */
    function initQnaList($) {
        const $qna = $('#prdQnA');
        if (!$qna.length) return;

        let lastQnaLink = null;
        let qnaLoadingTimer = null;
        let $qnaLoading = $qna.children('.qna-auth-loading').first();

        if (!$qnaLoading.length) {
            $qnaLoading = $('<div class="qna-auth-loading" role="status" aria-live="polite">' +
                '<span class="qna-auth-spinner" aria-hidden="true"></span>' +
                '<span>문의 내용을 불러오는 중입니다.</span>' +
                '</div>').appendTo($qna);
        }

        function isInCommentWriteForm($el) {
            return $el.closest('form[id^="commentWriteForm"]').length > 0;
        }

        function setQnaLoading(show) {
            window.clearTimeout(qnaLoadingTimer);
            $qnaLoading.toggleClass('is-visible', show);
            if (show) {
                qnaLoadingTimer = window.setTimeout(function () {
                    $qnaLoading.removeClass('is-visible');
                }, 5000);
            }
        }
        $qna.find('.xans-product-qna tbody > tr').each(function () {
            const $cells = $(this).children('td');
            $cells.eq(2).addClass('qna-subject');
            $cells.eq(3).addClass('qna-writer');
            $cells.eq(4).addClass('qna-date');
        });

        function validateQnaRead() {
            const $read = $qna.find('#product-qna-read');
            if (!$read.length) return;

            const answerCount = parseInt(
                $read.find('[onclick*="comment_view"] em').first().text(),
                10
            ) || 0;
            const $article = $read.find('.fr-view-article').first();
            const hasQuestionContent = $.trim($article.text()).length > 0 ||
                $article.find('img, video, iframe, audio').length > 0;
            const hasAnswerContent = $read.find('.boardComment li, .commentList li').length > 0;
            const hasSecretAccessForm = $read.find(
                'input[type="password"], .password, .secret, form[action*="Password"], form[action*="password"]'
            ).filter(function () {
                return !isInCommentWriteForm($(this));
            }).length > 0;
            const hasReadableContent = hasQuestionContent || answerCount > 0 ||
                hasAnswerContent || hasSecretAccessForm;

            if (hasQuestionContent) setQnaLoading(false);

            $read.toggleClass('has-qna-content', hasReadableContent);
            if (!hasReadableContent) {
                $read.hide();
                return;
            }

            $read.show();
        }

        $qna.off('click.qnaReadGuard', '.qna-subject a').on('click.qnaReadGuard', '.qna-subject a', function () {
            lastQnaLink = this;
            runAtDelays(validateQnaRead, [50, 200, 500]);
        });

        let secretReopenTimer = null;
        function reopenQnaAfterSecretAuth() {
            window.clearTimeout(secretReopenTimer);
            setQnaLoading(true);
            secretReopenTimer = window.setTimeout(function () {
                if (!lastQnaLink) return;
                $(lastQnaLink).trigger('click');
                runAtDelays(validateQnaRead, [100, 300, 700]);
            }, 700);
        }

        $(document).off('click.qnaSecretAuth').on('click.qnaSecretAuth', 'a, button, input[type="submit"], input[type="button"]', function () {
            if (!lastQnaLink || isInCommentWriteForm($(this))) return;
            const $visiblePassword = $('input[type="password"]:visible').filter(function () {
                return !isInCommentWriteForm($(this));
            });
            if (!$visiblePassword.length) return;
            reopenQnaAfterSecretAuth();
        });

        $(document).off('keydown.qnaSecretAuth').on('keydown.qnaSecretAuth', 'input[type="password"]', function (event) {
            if (event.key !== 'Enter' || isInCommentWriteForm($(this))) return;
            reopenQnaAfterSecretAuth();
        });

        const qnaTarget = $qna.find('.xans-product-qna').get(0);
        if (qnaTarget && window.MutationObserver) {
            if (qnaTarget.__qnaReadObserver) qnaTarget.__qnaReadObserver.disconnect();

            qnaTarget.__qnaReadObserver = new MutationObserver(validateQnaRead);
            qnaTarget.__qnaReadObserver.observe(qnaTarget, {
                childList: true,
                subtree: true
            });
        }
        validateQnaRead();
    }

    /* 리워드 상품 여부 확정 → 할인 산출 내역 노출 여부 다시 판단
       (라벨 상수·rewardProductState는 파일 상단에 선언) */
    function setRewardProductState($, isReward) {
        rewardProductState = isReward ? 'reward' : 'none';
        renderDiscountBreakdown($);
    }

    // th 안의 라벨 텍스트만 교체 (툴팁·할인율 span은 건드리지 않음)
    function replaceRowLabel($th, pattern, label) {
        $th.find('*').addBack().not('.price-tooltip, .price-tooltip *, .coupon-discount-rate').contents()
            .filter(function () {
                return this.nodeType === 3 && pattern.test(this.nodeValue);
            })
            .each(function () {
                this.nodeValue = this.nodeValue.replace(pattern, label);
            });
    }

    /* 네이버페이 리워드. 최종 구매가는 원본 판매가에서 보유 쿠폰 할인과 리워드를 한 번씩 뺀다. */

    function initNaverPayBenefit($, naverPayPaybackAmount) {
        settleRewardNotice($, naverPayPaybackAmount);
    }

    function finalPurchasePrice() {
        const salePrice = readUnitSalePrice();
        const couponDiscount = couponPriceReady ? (ownedCouponAppliedDiscount || 0) : 0;
        return Math.max(0, salePrice - couponDiscount - rewardBenefitAmount);
    }

    function paintActualPriceValue() {
        if (!rewardNoticeReady || !rewardBenefitAmount) return;
        if (detailQuery) ensureActualPriceRow(detailQuery);
        const value = document.querySelector('#npayBenefitBanner .actual-price-value');
        if (!value) return;

        if (!couponPriceReady) {
            value.textContent = '';
            value.classList.add('is-pending');
            value.setAttribute('aria-busy', 'true');
            return;
        }

        const next = formatWon(finalPurchasePrice());
        value.classList.remove('is-pending');
        value.removeAttribute('aria-busy');
        if (value.textContent !== next) value.textContent = next;
    }

    function ensureActualPriceRow($) {
        const $benefit = $('#npayBenefitBanner');
        // 최종 구매가(.actual-price-value)는 paintNaverPayBenefit()이 캐시백 안내 금액 자리에 만든다.
        // 판매가 라벨 교체는 값 요소마다 한 번만 실행
        const $value = $benefit.find('.actual-price-value').first();
        if (!$value.length || $value.data('labelRenamed')) return;
        if (!readUnitSalePrice()) return;

        const $saleRow = $('.xans-product-detaildesign tr.prd-sale-price').first();
        if ($saleRow.length) renameRewardSaleLabel($saleRow.find('th').first());
        $value.data('labelRenamed', true);

        // [기존] 최종 구매가를 별도 블록(.prd-actual-price)으로 추가
        // if (!$benefit.length || $benefit.find('.actual-price-value').length) return;
        // $benefit.append(
        //     '<div class="prd-actual-price">' +
        //     '<div class="actual-price-head">' +
        //     // '<span class="actual-price-label">최종 구매가</span>' +
        //     // '<span class="actual-price-note">쿠폰 및 최대 리워드 반영 기준의 예상 금액</span>' +
        //     '</div>' +
        //     '<strong class="actual-price-value"></strong>' +
        //     '</div>'
        // );
    }

    function renameRewardSaleLabel($th) {
        if (!$th || !$th.length) return;

        replaceRowLabel($th, SALE_PRICE_LABEL_PATTERN, SALE_PRICE_MEMBER_LABEL);

        // 툴팁 미사용
        // if (!$th.find('.price-tooltip').length) {
        //     $th.append(getTooltipHtml('memberPrice'));
        // }
    }

    function paintNaverPayBenefit($) {
        const $benefit = $('#npayBenefitBanner');
        const $footerNpay = $('#npayFooterSlot');
        setRewardProductState($, !!rewardBenefitAmount);

        if (!rewardBenefitAmount) {
            $benefit.empty();
            $footerNpay.empty();
            $('.prd-actual-price').remove();
            return;
        }

        if (!$benefit.find('.npay-benefit-inner').length) {
            $benefit.html(
                '<div class="npay-benefit-inner">' +
                    '<div class="npay-benefit__title">' +
                        '<strong>복용체크 캐시백 최대 적용 시</strong>' +
                        // [기존] 캐시백 할인 금액 (예: 4,000원)
                        // '<span><b>' + formatWon(rewardBenefitAmount) + '</b> </span>' +
                        // 최종 구매가 (쿠폰 및 최대 리워드 반영) — paintActualPriceValue()가 값을 채움
                        '<span class="actual-price-value is-pending"></span>' +
                    '</div>' +
                    // 툴팁 미사용
                    // getTooltipHtml('npayBenefit') +
                    '<span>복용 미션 완료 시 네이버페이 포인트로 지급</span>' +
                '</div>'
            );
        }


        ensureActualPriceRow($);
        paintActualPriceValue();

        if (!$footerNpay.find('.npay-fixed-button').length) {
            $footerNpay.html(
                '<button type="button" class="npay-fixed-button" ' +
                'aria-label="네이버페이 결제">' +
                '<span class="npay-mark">N</span>' +
                '<span>pay</span>' +
                '</button>'
            );
        }
    }

    function markCouponPriceReady() {
        couponPriceReady = true;
        if (detailQuery) paintNaverPayBenefit(detailQuery);
        else paintActualPriceValue();
    }

    function finalizeDetailActualPrice() {
        if (!couponPriceReady) ownedCouponAppliedDiscount = 0;
        markCouponPriceReady();
    }

    window.__finalizeDetailActualPrice = finalizeDetailActualPrice;

    // 슬라이드 그랩
    function initProductImageDrag($) {
        const $slider = $('.xans-product-mobileimage').first();
        if (!$slider.length) return;

        let startX = 0;
        let currentX = 0;
        let dragging = false;
        let dragged = false;

        function getCafe24Slider() {
            const id = $slider.attr('id') || '';
            return window['$' + id.replace(/-/g, '_')];
        }

        $slider.off('.productImageDrag');
        $(document).off('.productImageDrag');

        $slider.on('mousedown.productImageDrag', function (event) {
            if (event.which !== 1) return;
            startX = currentX = event.clientX;
            dragging = true;
            dragged = false;
            $slider.addClass('is-grabbing');
            event.preventDefault();
        });

        $(document).on('mousemove.productImageDrag', function (event) {
            if (!dragging) return;
            currentX = event.clientX;
            if (Math.abs(currentX - startX) > 6) dragged = true;
        }).on('mouseup.productImageDrag', function () {
            if (!dragging) return;
            const distance = currentX - startX;
            const cafe24Slider = getCafe24Slider();
            dragging = false;
            $slider.removeClass('is-grabbing');

            if (Math.abs(distance) < 45 || !cafe24Slider) return;
            if (distance < 0 && typeof cafe24Slider.next === 'function') cafe24Slider.next();
            if (distance > 0 && typeof cafe24Slider.prev === 'function') cafe24Slider.prev();
        });

        $slider.on('click.productImageDrag', 'a, img', function (event) {
            if (!dragged) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            dragged = false;
        }).on('dragstart.productImageDrag', 'img', function () {
            return false;
        });
    }

    /* 상품 요약 레이아웃 */
    function initDetailLayout($) {
        const $summary = $('.xans-product-detaildesign tr.prd-summary').first();
        const $heading = $('.xans-product-detail .headingArea').first();
        const $imageArea = $('.xans-product-detail .imgArea').first();
        const hasMobileSliderImage = $imageArea.find('.xans-product-mobileimage li img').length > 0;

        $imageArea.toggleClass('has-mobile-slider', hasMobileSliderImage);

        if (hasMobileSliderImage) {
            const triggerNativeResize = function () {
                try {
                    window.dispatchEvent(new Event('resize'));
                } catch (e) {
                    const evt = document.createEvent('UIEvent');
                    evt.initUIEvent('resize', true, false, window, 0);
                    window.dispatchEvent(evt);
                }
            };

            runAtDelays(triggerNativeResize, [0, 150, 500, 1200, 2000]);

            if (document.readyState === 'complete') {
                triggerNativeResize();
            } else {
                $(window).off('load.mobileSliderRelayout').on('load.mobileSliderRelayout', triggerNativeResize);
            }

            $imageArea.find('.xans-product-mobileimage img').each(function () {
                if (this.complete) return;
                $(this).off('.mobileSliderRelayout')
                    .on('load.mobileSliderRelayout error.mobileSliderRelayout', triggerNativeResize);
            });
        }

        if ($summary.length && $heading.length) {
            let $summaryContent = $summary.find('td').first().children().detach();
            if (!$summaryContent.length) $summaryContent = $('<span></span>').text($summary.find('td').text().trim());
            $('<div class="detail-summary"></div>').append($summaryContent).insertBefore($heading);
            $summary.remove();
        }

        $('.xans-product-mobileimage > ul').attr('aria-label', '상품 이미지 슬라이드');
        $('.xans-product-mobileimage > ul > li').each(function (index) {
            $(this).attr('aria-label', (index + 1) + '번째 상품 이미지');
        });
    }

    // 상품 금액 '원' 단위 강조
    function wrapPriceUnitNode(node) {
        if (!node) return;

        if (node.nodeType === 3) {
            const text = node.nodeValue;
            if (!/\d[\d,]*원/.test(text)) return;

            const re = /(\d[\d,]*)(원)/g;
            const frag = document.createDocumentFragment();
            let lastIndex = 0;
            let match;

            while ((match = re.exec(text))) {
                if (match.index > lastIndex) {
                    frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
                }
                frag.appendChild(document.createTextNode(match[1]));

                const unit = document.createElement('b');
                unit.className = 'price-unit';
                unit.textContent = match[2];
                frag.appendChild(unit);

                lastIndex = re.lastIndex;
            }

            if (lastIndex < text.length) {
                frag.appendChild(document.createTextNode(text.slice(lastIndex)));
            }

            node.parentNode.replaceChild(frag, node);
            return;
        }

        if (node.nodeType !== 1) return;
        if (node.classList && node.classList.contains('price-unit')) return;

        const tag = node.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'INPUT' || tag === 'SELECT') return;

        Array.prototype.slice.call(node.childNodes).forEach(wrapPriceUnitNode);
    }

    function initPriceUnitWrap($) {
        // 옵션 선택 
        const TARGET_SELECTOR =
            '.prd-sale-price, .prd-consumer-price, .prd-actual-price, .prd-best-discount-price, #totalProducts, #totalPrice';

        $(TARGET_SELECTOR).each(function () {
            const target = this;

            wrapPriceUnitNode(target);

            if (!window.MutationObserver || target.__priceUnitObserver) return;

            const observer = new MutationObserver(function () {
                observer.disconnect();
                wrapPriceUnitNode(target);
                observer.observe(target, { childList: true, subtree: true, characterData: true });
            });

            observer.observe(target, { childList: true, subtree: true, characterData: true });
            target.__priceUnitObserver = observer;
        });
    }

    // 상세 이미지 팝업
    function initDetailPopup() {
        const layer = document.createElement('div');
        const sheet = document.createElement('div');
        const scrollArea = document.createElement('div');
        const closeButton = document.createElement('button');

        layer.className = 'detail-popup-layer';
        sheet.className = 'detail-popup-sheet';
        scrollArea.className = 'detail-popup-scroll';
        closeButton.className = 'detail-popup-close';

        closeButton.type = 'button';
        closeButton.setAttribute('aria-label', '팝업 닫기');

        sheet.appendChild(closeButton);
        sheet.appendChild(scrollArea);
        layer.appendChild(sheet);
        document.body.appendChild(layer);

        function openPopup(trigger) {
            const popupItem = trigger.closest('.detail-popup-item');
            if (!popupItem) return;

            const popupContent = popupItem.querySelector('.detail-popup__box');
            if (!popupContent) return;

            const popupClone = popupContent.cloneNode(true);
            const images = popupClone.querySelectorAll('img[ec-data-src]');

            images.forEach(function (image) {
                const originalSrc = image.getAttribute('ec-data-src');
                if (originalSrc) image.src = originalSrc;
            });

            scrollArea.replaceChildren(popupClone);
            scrollArea.scrollTop = 0;

            document.documentElement.classList.add('detail-popup-open');
            document.body.classList.add('detail-popup-open');
            layer.classList.add('is-open');

            closeButton.focus();
        }

        function closePopup() {
            layer.classList.remove('is-open');
            document.documentElement.classList.remove('detail-popup-open');
            document.body.classList.remove('detail-popup-open');
            scrollArea.replaceChildren();
        }

        document.addEventListener('click', function (event) {
            const trigger = event.target.closest('.detail-img__trigger-btn');
            if (!trigger) return;

            // if (window.matchMedia('(max-width: 1024px)').matches) {
            //     return;
            // }

            event.preventDefault();
            event.stopPropagation();

            openPopup(trigger);
        });

        closeButton.addEventListener('click', closePopup);

        layer.addEventListener('click', function (event) {
            if (event.target === layer) closePopup();
        });

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && layer.classList.contains('is-open')) closePopup();
        });
    }

    /* 하단 구매 고정 바 */
    function initFixedPurchase($) {
        const $fixed = $('#prodOrderFixArea');
        const $origin = $('.productAction').first();
        const $layer = $('#fixedOptionLayer');
        const $content = $('#fixedOptionContent');
        const $actions = $('#fixedOptionActions');
        if (!$fixed.length || !$origin.length || !$layer.length || !$content.length || !$actions.length) return;

        $fixed.find('.actionCart').text('장바구니');
        $fixed.find('.fixed-btn-fill').first().text('구매하기');
        const $soldoutSource = $origin.find('.sub_sold').first();
        const isSoldOut = $soldoutSource.length && !$soldoutSource.hasClass('displaynone');
        $fixed.toggleClass('is-soldout', isSoldOut);
        $fixed.addClass('is-ready').attr('aria-hidden', 'true');

        // 필수 옵션 선택 여부 확인 (옵션상품/세트상품 미선택 시 false)
        function hasRequiredOptionSelected() {
            const $sourceSelected = $('#totalProducts');
            if (!$sourceSelected.length) return true;

            const $productOptions = $('.xans-product-detail .infoArea').first()
                .children('.xans-product-option')
                .find('select');
            if (!$productOptions.length) return true;

            return $sourceSelected.find('tr.option_product').length > 0;
        }

        // 구매하기/장바구니 레이어 팝업 호출 막기
        if (!$origin.data('requiredOptionGuardBound')) {
            $origin.data('requiredOptionGuardBound', true);
            $origin.get(0).addEventListener('click', function (event) {
                const actionTarget = event.target.closest &&
                    event.target.closest('a.btnSubmit.sizeL, .actionCart');
                if (!actionTarget || hasRequiredOptionSelected()) return;

                event.preventDefault();
                event.stopImmediatePropagation();
                window.alert(REQUIRED_OPTION_ALERT_MESSAGE);
            }, true);
        }

        let fixedStart = 0;

        function calculateFixedStart() {
            if (!$origin.length) return;
            fixedStart = $origin.offset().top + $origin.outerHeight();
        }

        function updateFixedVisibility() {
            const show = $(window).scrollTop() >= fixedStart;
            $fixed.toggleClass('is-visible', show).attr('aria-hidden', show ? 'false' : 'true');
        }

        calculateFixedStart();
        $(window).off('scroll.fixedPurchase').on('scroll.fixedPurchase', updateFixedVisibility);
        $(window).off('resize.fixedPurchase load.fixedPurchase').on('resize.fixedPurchase load.fixedPurchase', function () {
            calculateFixedStart();
            updateFixedVisibility();
        });
        let resizeObserver = $fixed.data('fixedPurchaseResizeObserver');
        if (resizeObserver) resizeObserver.disconnect();

        if (window.ResizeObserver) {
            resizeObserver = new ResizeObserver(function () {
                calculateFixedStart();
                updateFixedVisibility();
            });
            resizeObserver.observe($origin[0]);
            $fixed.data('fixedPurchaseResizeObserver', resizeObserver);
        }
        window.clearTimeout($fixed.data('fixedPurchaseStartTimer'));
        $fixed.data('fixedPurchaseStartTimer', window.setTimeout(calculateFixedStart, 300));
        updateFixedVisibility();

        // 카페24 옵션 DOM 갱신 대응
        function scheduleSheetRefresh() {
            runAtDelays(function () {
                if ($layer.hasClass('is-open')) buildSheet();
            }, [60, 220, 500]);
        }


        // 원본 select / 시트 select
        function appendOptionFields() {
            const $sourceOptions = $('.xans-product-detail .infoArea').first()
                .children('.xans-product-option, .productSet').find('select');
            if (!$sourceOptions.length) return;

            const $fields = $('<div class="fixed-option-fields"></div>');
            $sourceOptions.each(function (index) {
                const $source = $(this);
                const sourceId = this.id || '';
                const isAddProduct = $source.closest('.productSet').length > 0;
                const label = $source.closest('tr').find('th').first().text().trim() ||
                    $source.closest('li').find('.name').first().text().trim() || '옵션 선택';
                const $field = $('<div class="fixed-option-field"></div>');
                const $select = $('<select class="fixed-option-select"></select>')
                    .html($source.html())
                    .prop('selectedIndex', 0)
                    .attr('aria-label', label)
                    .attr('data-source-index', index)
                    .attr('data-source-id', sourceId)
                    .attr('data-option-kind', isAddProduct ? 'addproduct' : 'product');

                $('<span class="fixed-option-label"></span>').text(label).appendTo($field);
                $select.appendTo($field);
                $field.appendTo($fields);
            });

            $fields.on('change', '.fixed-option-select', function () {
                const sourceId = $(this).attr('data-source-id');
                const sourceIndex = Number($(this).attr('data-source-index'));
                const source = sourceId ? document.getElementById(sourceId) : $sourceOptions.get(sourceIndex);
                if (!source) return;

                source.selectedIndex = this.selectedIndex;
                source.value = this.value;
                source.dispatchEvent(new Event('input', { bubbles: true }));
                source.dispatchEvent(new Event('change', { bubbles: true }));
                source.blur();
                scheduleSheetRefresh();
            });
            $content.append($fields);
        }

        // 수량/삭제 컨트롤 클릭
        function bindSelectedProductControls($cloneRow, $sourceProductRows, rowIndex) {
            const $sourceRow = $sourceProductRows.eq(rowIndex);
            const $nameCell = $cloneRow.children('td').first();
            let $originalDelete = $sourceRow.find('.delete').first();

            if (!$originalDelete.length) {
                $originalDelete = $sourceRow.find('.option_box_del').first().closest('a');
            }

            // 삭제 가능한 옵션상품
            if ($originalDelete.length) {
                const $deleteButton = $('<button type="button" class="fixed-selected-delete" aria-label="선택상품 삭제"></button>');

                $deleteButton.on('click.fixedSheetDelete', function () {
                    $originalDelete.trigger('click');
                    scheduleSheetRefresh();
                });

                $nameCell.append($deleteButton);
            }

            // 수량
            $cloneRow.find('.fixed-quantity-up, .fixed-quantity-down').on('click.fixedSheetQuantity', function (event) {
                const isUp = $(this).hasClass('fixed-quantity-up');
                const selector = isUp ? '.up' : '.down';
                const $original = $sourceRow.find(selector).first();

                event.preventDefault();
                event.stopPropagation();

                if (!$original.length) return;

                const $trigger = $original.is('a, button') ? $original : $original.closest('a, button');
                ($trigger.length ? $trigger : $original).get(0).click();

                scheduleSheetRefresh();
            });
        }

        function appendSelectedProducts() {
            const $sourceSelected = $('#totalProducts');
            if (!$sourceSelected.length) return false;

            const $productOptions = $('.xans-product-detail .infoArea').first()
                .children('.xans-product-option')
                .find('select');

            const hasProductOptions = $productOptions.length > 0;
            let $sourceProductRows = $sourceSelected.find('tr.option_product, tr.add_product');

            // 옵션 없는 단일상품
            if (!hasProductOptions && !$sourceProductRows.length) {
                $sourceProductRows = $sourceSelected
                    .find('tbody.total-product-group')
                    .first()
                    .children('tr')
                    .not('.option')
                    .first();
            }

            // 옵션 미선택 
            if (!$sourceProductRows.length) return false;

            const $selected = $sourceSelected.clone(false).removeAttr('id').addClass('fixed-selected-products');
            let $clonedProductRows;

            if (hasProductOptions) {
                $clonedProductRows = $selected.find('tr.option_product, tr.add_product');
                $selected.find('tr').not('.option_product, .add_product').remove();
            } else {
                $clonedProductRows = $selected
                    .find('tbody.total-product-group')
                    .first()
                    .children('tr')
                    .not('.option')
                    .first();

                $selected.find('tr').not($clonedProductRows).remove();
            }

            $selected.find('tbody').filter(function () {
                return !$(this).children().length;
            }).remove();

            $selected.find('[id]').removeAttr('id');
            $selected.find('[name]').removeAttr('name');
            $selected.find('a').removeAttr('href onclick');
            $selected.find('input').prop('readonly', true);
            $selected.find('.delete, .option_box_del').hide();

            $clonedProductRows.each(function (rowIndex) {
                const $cloneRow = $(this);
                const $nameCell = $cloneRow.children('td').first().addClass('fixed-selected-product-name');
                const $metaCell = $('<td class="fixed-selected-product-meta"></td>');

                let $quantity = $cloneRow.find('.quantity, p').filter(function () {
                    return $(this).children('.quantity_opt').length > 0;
                }).first();

                if (!$quantity.length) {
                    $quantity = $cloneRow.find('.quantity').first();
                }

                if ($quantity.length) {
                    $quantity = $quantity.detach().addClass('quantity fixed-selected-quantity');
                    normalizeQuantityControl($quantity);
                }

                // 가격
                let $price;
                if (!hasProductOptions) {
                    const totalPriceText = $('#totalPrice .total em').first().text().trim();

                    if (totalPriceText) {
                        $price = $('<span class="fixed-single-product-price"></span>').text(totalPriceText);
                    } else {
                        $price = $();
                    }
                } else {
                    $price = $cloneRow.find('.ec-front-product-item-price').first();
                    if (!$price.length) $price = $cloneRow.find('.option_box_price').first().next('span');
                    if (!$price.length) $price = $cloneRow.find('td.right > span').not('.mileage').first();
                }

                // 바텀시트 수량 UI 정규화
                function normalizeQuantityControl($quantity) {
                    if (!$quantity.length) return;

                    const $input = $quantity.find('input').first();
                    if (!$input.length) return;

                    $quantity
                        .empty()
                        .append('<button type="button" class="fixed-quantity-down" aria-label="수량 감소">−</button>')
                        .append($input)
                        .append('<button type="button" class="fixed-quantity-up" aria-label="수량 증가">+</button>');
                }


                $cloneRow.children('td').not($nameCell).remove();

                if ($quantity.length) $metaCell.append($quantity);
                if ($price.length) $metaCell.append($price.detach().addClass('fixed-selected-price'));

                $cloneRow.addClass('fixed-selected-product').append($metaCell);

                bindSelectedProductControls($cloneRow, $sourceProductRows, rowIndex);
            });

            $content.append($selected);

            return true;
        }

        function appendTotalPrice(hasSelectedProducts) {
            const $sheetTotal = $('#totalPrice').clone(false).removeAttr('id').addClass('fixed-total-price');

            if (!hasSelectedProducts) {
                $sheetTotal.find('.total').html('<strong><em>0원</em></strong> (0개)');
            }

            $content.append($sheetTotal);
        }

        function buildActions() {
            $actions.empty().append($fixed.find('.prod-fixed-buttons').children().not('.prod-soldout-button').clone(false));
            $actions.find('[id]').removeAttr('id');
            $actions.find('[onclick]').removeAttr('onclick');
            $actions.find('a').attr('href', '#none');
            $actions.find('.actionCart').on('click', function (event) {
                event.preventDefault();
                // 원본 장바구니 버튼 클릭 팝업 차단
                const cartButton = $origin.find('.actionCart').first().get(0);
                if (cartButton) cartButton.click();
            });
            $actions.find('.fixed-btn-fill').on('click', function (event) {
                event.preventDefault();
                const submitButton = $origin.find('.btnSubmit:visible').first().get(0);
                if (submitButton) submitButton.click();
            });
        }

        function buildSheet() {
            $content.empty();
            appendOptionFields();

            const hasSelectedProducts = appendSelectedProducts();
            appendTotalPrice(hasSelectedProducts);
            buildActions();
        }

        function openSheet() {
            buildSheet();
            $layer.addClass('is-open').attr('aria-hidden', 'false');
            $('body').addClass('fixed-option-open');
        }
        function closeSheet() {
            $layer.removeClass('is-open').attr('aria-hidden', 'true');
            $('body').removeClass('fixed-option-open');
        }

        $fixed.off('click.fixedPurchase', '[data-fixed-option-open]').on('click.fixedPurchase', '[data-fixed-option-open]', function (event) {
            event.preventDefault();
            event.stopImmediatePropagation();
            openSheet();
        });
        $layer.off('click.fixedPurchase', '[data-fixed-option-close]').on('click.fixedPurchase', '[data-fixed-option-close]', closeSheet);
        $(document).off('keydown.fixedPurchase').on('keydown.fixedPurchase', function (event) {
            if (event.key === 'Escape') closeSheet();
        });
    }

    /* 상품정보 테이블 행에 라벨 기반 클래스 부여 */
    function initProductInfoTable($) {
        const $rows = $('.xans-product-detaildesign table tr');
        if (!$rows.length) return;

        $rows.each(function () {
            const $row = $(this);
            const label = $row.find('th').first().text().trim();
            if (!label) return;

            const className = PRODUCT_INFO_LABEL_CLASS_MAP[label] || 'prd-' + label.replace(/\s+/g, '');
            $row.addClass(className);
        });
    }

    /* 가격 행 재구성: 정가는 판매가 앞, 배송비는 마지막 + 행별 툴팁(PRICE_ROW_TOOLTIPS) */
    function initPriceRows($) {
        $('.xans-product-detaildesign table').each(function () {
            const $table = $(this);
            const $saleRow = $table.find('tr.prd-sale-price').first();
            const $consumerRow = $table.find('tr.prd-consumer-price').first();
            const $deliveryRow = $table.find('tr.prd-delivery-fee').first();

            // 정가는 판매가 바로 앞, 배송비는 항상 마지막 행 (각 행은 별도로 노출)
            if ($saleRow.length && $consumerRow.length) $consumerRow.insertBefore($saleRow);
            if ($deliveryRow.length) $deliveryRow.appendTo($deliveryRow.parent());

            // td > span.sale-price-group > span(판매가)
            const $saleTd = $saleRow.find('td').first();
            if ($saleTd.length && !$saleTd.children('.sale-price-group').length) {
                $saleTd.children('span').wrapAll('<span class="sale-price-group"></span>');
            }
            if ($saleRow.length) $saleRow.attr('data-sale-price-row', '1');

            // 툴팁 미사용
            // $.each(PRICE_ROW_TOOLTIPS, function (rowClass, tooltipKey) {
            //     const $th = $table.find('tr.' + rowClass).first().find('th').first();
            //     if (!$th.length || $th.find('.price-tooltip').length) return;
            //     $th.append(getTooltipHtml(tooltipKey));
            // });
        });
    }

    /* 보유 쿠폰 예상 금액
       조회와 계산은 owned-coupon.js가 담당한다. 이 파일은 상세 화면 표시만 한다.
       로그인 회원의 쿠폰 목록을 읽고, 적용 상품 목록에 현재 상품번호가 있는 쿠폰만 비교한다.
       정률의 소수 원 버림은 이 화면의 표시 정책이며, 카페24 주문서 계산과 같다고 두지 않는다.
       최대 할인한도 칸이 비어 있으면 한도를 빼지 않는다. '한도 없음'으로 저장하지 않는다. */
    const OWNED_COUPON_ESTIMATE_NOTE = '보유 쿠폰 중 최대 할인 기준이며, 주문서에서 쿠폰 적용 시 반영됩니다.';

    let ownedCouponEstimateSeq = 0;
    let ownedCouponLoginWatchBound = false;
    let ownedCouponEstimateStatus = '';
    let ownedCouponCandidates = [];
    let ownedCouponObservedSale = 0;
    let ownedCouponAppliedDiscount = 0;
    let ownedCouponOriginSalePrice = 0;
    let ownedCouponSaleObserver = null;
    let detailPriceConfirmed = false;
    let detailConfirmedSale = 0;
    let detailDiscountUnwatch = null;

    function currentDetailProductNo() {
        try {
            const fromGlobal = getProductNo();
            if (fromGlobal) return fromGlobal;
        } catch (e) {
            // 상품번호 전역값이 없으면 주소의 product_no로 비교한다.
        }
        if (typeof window.location === 'undefined') return '';
        if (!window.GcOwnedCoupon) return '';
        return window.GcOwnedCoupon.productNoFromHref(window.location.href);
    }

    function getDetailSaleRow() {
        const marked = document.querySelector('.xans-product-detaildesign tr[data-sale-price-row]');
        const row = marked || document.querySelector('.xans-product-detaildesign tr.prd-sale-price');
        if (row && row.getAttribute('data-sale-price-row') !== '1') row.setAttribute('data-sale-price-row', '1');
        return row;
    }

    function readUnitSalePrice() {
        const row = getDetailSaleRow();
        const node = row ? row.querySelector('#span_product_price_text') : null;
        if (!node) return ownedCouponOriginSalePrice || 0;

        const clone = node.cloneNode(true);
        const extras = clone.querySelectorAll('.coupon-sale-amount, .coupon-sale-rate');
        for (let i = 0; i < extras.length; i++) extras[i].remove();
        const match = String(clone.textContent || '').match(/[\d,]+원/);
        const value = match ? Number(match[0].replace(/[^\d]/g, '')) : 0;
        if (value > 0) {
            ownedCouponOriginSalePrice = value;
            return value;
        }
        if (node.classList.contains('coupon-sale-origin') && ownedCouponOriginSalePrice > 0) {
            return ownedCouponOriginSalePrice;
        }
        return 0;
    }

    function placeBeforeOrigin(node, origin) {
        if (!origin || !origin.parentNode) return false;
        origin.parentNode.insertBefore(node, origin);
        return true;
    }

    function couponSalePercent(discount, salePrice) {
        if (window.GcOwnedCoupon && typeof window.GcOwnedCoupon.salePercent === 'function') {
            return window.GcOwnedCoupon.salePercent(discount, salePrice);
        }
        if (!(salePrice > 0) || !(discount > 0)) return 0;
        return Math.round(discount / salePrice * 100);
    }

    // 소비자가 행의 금액 (표시 중인 행만). 판매가 td로 옮겨진 .consumer-price-inline도 허용
    function readConsumerPrice() {
        const row = document.querySelector('.xans-product-detaildesign tr.prd-consumer-price:not(.displaynone)');
        const cell = row ? row.querySelector('td') : null;
        let value = cell ? parsePriceNumber(cell.textContent) : 0;
        if (value > 0) return value;

        const inline = document.querySelector('.xans-product-detaildesign tr.prd-sale-price .consumer-price-inline');
        value = inline ? parsePriceNumber(inline.textContent) : 0;
        return value > 0 ? value : 0;
    }

    // 소비자가 대비 최대할인가(쿠폰 적용가) 할인율. 소비자가가 없거나 쿠폰가보다 크지 않으면 판매가 기준
    function couponConsumerSalePercent(discount, salePrice) {
        const finalPrice = salePrice - discount;
        if (!(salePrice > 0) || !(discount > 0) || !(finalPrice > 0)) return 0;

        const consumer = readConsumerPrice();
        const base = consumer > finalPrice ? consumer : salePrice;
        if (!(base > finalPrice)) return 0;
        return Math.round(100 - (finalPrice * 100) / base);
    }

    function couponSaleLabelTexts(saleRow, visitor) {
        const th = saleRow.querySelector('th');
        if (!th) return;
        const walker = document.createTreeWalker(th, NodeFilter.SHOW_TEXT, null);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(function (node) {
            if (node.parentElement && node.parentElement.closest('.price-tooltip')) return;
            visitor(node);
        });
    }

    function applyCouponSaleLabel(saleRow) {
        couponSaleLabelTexts(saleRow, function (node) {
            if (!/판매가|구매가/.test(node.nodeValue)) return;
            if (!saleRow.getAttribute('data-origin-sale-label')) {
                const matched = node.nodeValue.match(/판매가|구매가/);
                if (matched) saleRow.setAttribute('data-origin-sale-label', matched[0]);
            }
            node.nodeValue = node.nodeValue.replace(/판매가|구매가/, '최대할인가');
        });
    }

    function restoreCouponSaleLabel(saleRow) {
        const origin = saleRow.getAttribute('data-origin-sale-label');
        if (!origin) return;
        couponSaleLabelTexts(saleRow, function (node) {
            if (node.nodeValue.indexOf('최대할인가') === -1) return;
            node.nodeValue = node.nodeValue.replace('최대할인가', origin);
        });
        saleRow.removeAttribute('data-origin-sale-label');
    }

    function clearCouponSaleDisplay() {
        const saleRow = getDetailSaleRow();
        if (!saleRow) return;
        saleRow.classList.remove('is-coupon-sale-display');
        const extras = saleRow.querySelectorAll('.coupon-sale-rate, .coupon-sale-amount');
        for (let i = 0; i < extras.length; i++) extras[i].remove();
        const origin = saleRow.querySelector('#span_product_price_text');
        if (origin) {
            origin.classList.remove('coupon-sale-origin');
            origin.removeAttribute('aria-hidden');
        }
        restoreCouponSaleLabel(saleRow);
    }

    function syncCouponSaleDisplay(salePrice, discount) {
        const saleRow = getDetailSaleRow();
        if (!saleRow || !(discount > 0) || !(salePrice > 0)) {
            clearCouponSaleDisplay();
            return;
        }

        const origin = saleRow.querySelector('#span_product_price_text');
        if (!origin || !origin.parentNode) return;

        // [기존] 판매가 대비 쿠폰 % (예: 14%)
        // const percent = couponSalePercent(discount, salePrice);
        const percent = couponConsumerSalePercent(discount, salePrice);
        const amountText = formatWon(Math.max(0, salePrice - discount));
        let amount = saleRow.querySelector('.coupon-sale-amount');
        if (!amount) {
            amount = document.createElement('span');
            amount.className = 'coupon-sale-amount';
            if (!placeBeforeOrigin(amount, origin)) return;
        }
        if (amount.textContent !== amountText) amount.textContent = amountText;

        let rate = saleRow.querySelector('.coupon-sale-rate');
        if (percent > 0) {
            if (!rate) {
                rate = document.createElement('strong');
                rate.className = 'discount-rate coupon-sale-rate';
                if (!placeBeforeOrigin(rate, amount)) return;
            }
            const rateText = percent + '%';
            if (rate.textContent !== rateText) rate.textContent = rateText;
        } else if (rate) {
            rate.remove();
        }

        if (!saleRow.classList.contains('is-coupon-sale-display')) {
            saleRow.classList.add('is-coupon-sale-display');
        }
        applyCouponSaleLabel(saleRow);
        if (!origin.classList.contains('coupon-sale-origin')) origin.classList.add('coupon-sale-origin');
        if (origin.getAttribute('aria-hidden') !== 'true') origin.setAttribute('aria-hidden', 'true');
    }

    function loadOwnedCouponCandidates(productNo) {
        if (!window.GcOwnedCoupon || typeof window.GcOwnedCoupon.loadCatalog !== 'function') {
            return Promise.resolve({ status: 'fetch-fail', candidates: [] });
        }
        return window.GcOwnedCoupon.loadCatalog().then(function (catalog) {
            if (!catalog || catalog.status === 'stale') {
                return { status: 'stale', candidates: [] };
            }
            if (catalog.status !== 'ready') {
                return { status: catalog.status, candidates: [] };
            }
            const candidates = [];
            (catalog.coupons || []).forEach(function (coupon) {
                const productNos = coupon.productNos || [];
                const applies = productNos.indexOf(String(productNo)) !== -1;
                if (applies) candidates.push(coupon);
            });
            if (!candidates.length) return { status: 'no-match', candidates: [] };
            return { status: 'ready', candidates: candidates };
        });
    }

    function selectLargestOwnedCouponDiscount(salePrice, coupons) {
        if (!window.GcOwnedCoupon) return 0;
        return window.GcOwnedCoupon.selectLargest(salePrice, coupons);
    }

    function removeOwnedCouponEstimate() {
        const rows = document.querySelectorAll('tr.prd-owned-coupon-estimate');
        for (let i = 0; i < rows.length; i++) rows[i].remove();
        const toggles = document.querySelectorAll('.owned-coupon-estimate-toggle');
        for (let j = 0; j < toggles.length; j++) toggles[j].remove();
    }

    /* 최대할인가 라벨 옆 화살표 토글  */
    let ownedCouponEstimateOpen = false;

    function setOwnedCouponEstimateOpen(row, toggle, open) {
        ownedCouponEstimateOpen = open;
        row.style.display = open ? '' : 'none';
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        const svg = toggle.querySelector('svg');
        if (svg) svg.style.transform = open ? 'rotate(180deg)' : '';
    }

    function ensureOwnedCouponEstimateToggle(saleRow, row) {
        const th = saleRow.querySelector('th');
        if (!th) return;

        let toggle = th.querySelector('.owned-coupon-estimate-toggle');
        if (!toggle) {
            toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'owned-coupon-estimate-toggle';
            toggle.setAttribute('aria-label', '최대할인가 내역 보기');
            toggle.style.cssText = 'display:inline-flex;align-items:center;margin-left:4px;padding:0;border:0;background:none;cursor:pointer;vertical-align:middle;';
            toggle.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none">' +
                '<path d="M2 4.5L5.78462 8.40382C5.81224 8.43418 5.8456 8.45838 5.88265 8.47492C5.91969 8.49147 5.95963 8.5 6 8.5C6.04037 8.5 6.08031 8.49147 6.11735 8.47492C6.1544 8.45838 6.18776 8.43418 6.21538 8.40382L10 4.5" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" stroke="#2A2A2A"/>' +
                '</svg>';
            th.appendChild(toggle);
        }

        // 최대할인가 토글 
        if (!th.dataset.estimateToggleBound) {
            th.dataset.estimateToggleBound = '1';
            th.style.cursor = 'pointer';
            th.addEventListener('click', function () {
                const currentRow = document.querySelector('.xans-product-detaildesign tr.prd-owned-coupon-estimate');
                const currentToggle = th.querySelector('.owned-coupon-estimate-toggle');
                if (currentRow && currentToggle) setOwnedCouponEstimateOpen(currentRow, currentToggle, !ownedCouponEstimateOpen);
            });
        }
        setOwnedCouponEstimateOpen(row, toggle, ownedCouponEstimateOpen);
    }

    function appendEstimateRow(parent, label, value, result) {
        const line = document.createElement('div');
        line.className = 'owned-coupon-estimate__row' + (result ? ' owned-coupon-estimate__row--result' : '');

        const name = document.createElement('span');
        name.className = 'owned-coupon-estimate__label';
        name.textContent = label;

        const amount = document.createElement(result ? 'strong' : 'span');
        amount.className = 'owned-coupon-estimate__value';
        amount.textContent = value;

        line.appendChild(name);
        line.appendChild(amount);
        parent.appendChild(line);
    }

    function renderOwnedCouponEstimate(salePrice, discount) {
        const saleRow = getDetailSaleRow();
        if (!saleRow || !saleRow.parentNode) {
            removeOwnedCouponEstimate();
            return;
        }

        let row = document.querySelector('.xans-product-detaildesign tr.prd-owned-coupon-estimate');
        if (!row) {
            row = document.createElement('tr');
            row.className = 'prd-owned-coupon-estimate';
            const cell = document.createElement('td');
            cell.colSpan = 2;
            row.appendChild(cell);
        }
        if (row.previousElementSibling !== saleRow) {
            saleRow.insertAdjacentElement('afterend', row);
        }

        const cell = row.querySelector('td');
        cell.colSpan = 2;
        while (cell.firstChild) cell.removeChild(cell.firstChild);

        const box = document.createElement('div');
        box.className = 'owned-coupon-estimate';

        // const basis = document.createElement('p');
        // basis.className = 'owned-coupon-estimate__basis';
        // basis.textContent = '상품 1개 기준';
        // box.appendChild(basis);

        const expected = Math.max(0, salePrice - discount);
        appendEstimateRow(box, '판매가', formatWon(salePrice), false);
        appendEstimateRow(box, '보유 쿠폰 할인', '-' + formatWon(discount), false);
        appendEstimateRow(box, '최대 할인가', formatWon(expected), true);

        const note = document.createElement('p');
        note.className = 'owned-coupon-estimate__note';
        note.textContent = OWNED_COUPON_ESTIMATE_NOTE;
        box.appendChild(note);
        cell.appendChild(box);

        ensureOwnedCouponEstimateToggle(saleRow, row);
    }

    function paintOwnedCouponEstimate() {
        const salePrice = readUnitSalePrice();
        ownedCouponObservedSale = salePrice;

        if (!ownedCouponCandidates.length) ownedCouponOriginSalePrice = 0;

        if (!ownedCouponCandidates.length || !salePrice) {
            ownedCouponAppliedDiscount = 0;
            clearCouponSaleDisplay();
            if (!salePrice && ownedCouponCandidates.length) {
                ownedCouponEstimateStatus = 'no-sale';
            }
            removeOwnedCouponEstimate();
            refreshActualPriceFromCoupon();
            return;
        }

        const best = selectLargestOwnedCouponDiscount(salePrice, ownedCouponCandidates);

        if (best <= 0) {
            ownedCouponAppliedDiscount = 0;
            ownedCouponEstimateStatus = 'no-discount';
            clearCouponSaleDisplay();
            removeOwnedCouponEstimate();
            refreshActualPriceFromCoupon();
            return;
        }

        ownedCouponAppliedDiscount = best;
        ownedCouponEstimateStatus = 'shown';
        renderOwnedCouponEstimate(salePrice, best);
        try {
            syncCouponSaleDisplay(salePrice, best);
        } catch (error) {}

        refreshActualPriceFromCoupon();
    }

    function refreshActualPriceFromCoupon() {
        if (couponPriceReady) paintActualPriceValue();
    }

    function watchOwnedCouponSalePrice() {
        const table = document.querySelector('.xans-product-detaildesign table');
        if (!table || ownedCouponSaleObserver || typeof MutationObserver === 'undefined') return;
        ownedCouponObservedSale = readUnitSalePrice();

        ownedCouponSaleObserver = new MutationObserver(function () {
            const sale = readUnitSalePrice();
            if (sale !== ownedCouponObservedSale) {
                ownedCouponObservedSale = sale;
                detailPriceConfirmed = false;
                detailConfirmedSale = 0;
                if (window.GcOwnedCoupon &&
                    typeof window.GcOwnedCoupon.reevaluateProductDiscount === 'function' &&
                    window.GcOwnedCoupon.reevaluateProductDiscount()) {
                    if (!detailPriceConfirmed) concealDetailPrice();
                    return;
                }
                paintOwnedCouponEstimate();
                return;
            }

            if (ownedCouponAppliedDiscount > 0) {
                syncCouponSaleDisplay(sale, ownedCouponAppliedDiscount);
            }

            const saleRow = getDetailSaleRow();
            const row = document.querySelector('.xans-product-detaildesign tr.prd-owned-coupon-estimate');
            if (saleRow && row && row.previousElementSibling !== saleRow) {
                saleRow.insertAdjacentElement('afterend', row);
            }
        });
        ownedCouponSaleObserver.observe(table, {
            childList: true,
            characterData: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });
    }

    function detailLookupCurrent(seq, productNo, requestToken) {
        if (window.__detailPriceLookupAborted) return false;
        if (requestToken !== (window.__detailPriceLookupToken || 1)) return false;
        if (seq !== ownedCouponEstimateSeq) return false;
        return String(productNo) === String(currentDetailProductNo() || '');
    }

    function concealDetailPrice() {
        detailPriceConfirmed = false;
        detailConfirmedSale = 0;
        couponPriceReady = false;
        ownedCouponAppliedDiscount = 0;
        ownedCouponCandidates = [];
        clearCouponSaleDisplay();
        removeOwnedCouponEstimate();
        paintActualPriceValue();
        if (typeof window.__holdDetailPriceLoading === 'function') {
            window.__holdDetailPriceLoading();
            return;
        }
        const root = document.querySelector('.xans-product-detaildesign');
        if (root) {
            root.classList.remove('is-detail-price-ready');
            root.setAttribute('aria-busy', 'true');
        }
    }

    function commitDetailPrice(seq, productNo, requestToken, result) {
        if (!result || result.pending) return;
        if (!detailLookupCurrent(seq, productNo, requestToken)) return;
        const sale = readUnitSalePrice();
        if (detailPriceConfirmed && sale === detailConfirmedSale) return;
        detailPriceConfirmed = true;
        detailConfirmedSale = sale;
        if (window.GcOwnedCoupon && typeof window.GcOwnedCoupon.noteDetailPriceConfirmed === 'function') {
            window.GcOwnedCoupon.noteDetailPriceConfirmed();
        }
        acceptOwnedCouponResult(seq, productNo, requestToken, result);
    }

    function settleCouponPricePending() {
        if (typeof window.__releaseDetailPriceLoading === 'function') {
            window.__releaseDetailPriceLoading();
        } else {
            const root = document.querySelector('.xans-product-detaildesign');
            if (root) {
                root.classList.add('is-detail-price-ready');
                root.removeAttribute('aria-busy');
            }
        }
        if (typeof window.__runDetailSalePercent === 'function') {
            window.__runDetailSalePercent();
        }
    }

    function acceptOwnedCouponResult(seq, productNo, requestToken, result) {
        if (window.__detailPriceLookupAborted || requestToken !== (window.__detailPriceLookupToken || 1)) return;
        if (seq !== ownedCouponEstimateSeq) return;
        const currentProductNo = currentDetailProductNo();
        if (String(productNo) !== String(currentProductNo || '')) return;
        ownedCouponCandidates = result.candidates;
        ownedCouponEstimateStatus = result.status;
        watchOwnedCouponSalePrice();
        if (result.status === 'fetch-fail') {
            console.warn('[DETAIL][OWNED_COUPON] fetch failed');
            ownedCouponAppliedDiscount = 0;
            clearCouponSaleDisplay();
            removeOwnedCouponEstimate();
        } else {
            paintOwnedCouponEstimate();
        }
        markCouponPriceReady();
        settleCouponPricePending();
    }

    function initOwnedCouponEstimate($) {
        let tries = 0;
        let loginRetries = 0;

        function start() {
            if (window.__detailPriceLookupAborted) {
                ownedCouponEstimateStatus = 'recovery';
                finalizeDetailActualPrice();
                return;
            }
            const productNo = currentDetailProductNo();
            if (!productNo) {
                if (tries < 8) {
                    tries += 1;
                    window.setTimeout(start, 250);
                    return;
                }
                ownedCouponEstimateStatus = 'no-product';
                ownedCouponAppliedDiscount = 0;
                clearCouponSaleDisplay();
                removeOwnedCouponEstimate();
                markCouponPriceReady();
                settleCouponPricePending();
                return;
            }

            if (detailDiscountUnwatch) {
                detailDiscountUnwatch();
                detailDiscountUnwatch = null;
            }
            detailPriceConfirmed = false;
            detailConfirmedSale = 0;
            const seq = ++ownedCouponEstimateSeq;
            const requestToken = window.__detailPriceLookupToken || 1;
            if (window.GcOwnedCoupon && typeof window.GcOwnedCoupon.watchProductDiscount === 'function') {
                detailDiscountUnwatch = window.GcOwnedCoupon.watchProductDiscount({
                    productNo: String(productNo),
                    getSalePrice: function () { return readUnitSalePrice(); },
                    onDecision: function (decision) {
                        commitDetailPrice(seq, productNo, requestToken, decision);
                    }
                });
            }
            loadOwnedCouponCandidates(productNo).then(function (result) {
                if (seq !== ownedCouponEstimateSeq) return;
                if (result && result.status === 'stale') {
                    if (loginRetries < 1) {
                        loginRetries += 1;
                        start();
                        return;
                    }
                    result = { candidates: [], status: 'fetch-fail' };
                } else {
                    loginRetries = 0;
                }
                commitDetailPrice(seq, productNo, requestToken, result);
            }).catch(function () {
                if (seq !== ownedCouponEstimateSeq) return;
                commitDetailPrice(seq, productNo, requestToken, { candidates: [], status: 'fetch-fail' });
            });
        }

        if (!ownedCouponLoginWatchBound) {
            ownedCouponLoginWatchBound = true;
            window.addEventListener('pageshow', function (event) {
                if (!event.persisted || !window.GcOwnedCoupon) return;
                window.GcOwnedCoupon.reset('BFCache 복귀');
                window.__detailPriceLookupAborted = false;
                window.__detailPriceLookupToken = (window.__detailPriceLookupToken || 1) + 1;
                loginRetries = 0;
                start();
            });
            window.addEventListener('gc-owned-coupon-login-changed', function () {
                if (window.__detailPriceLookupAborted) return;
                loginRetries = 0;
                start();
            });
        }

        start();
    }

    /* 할인 산출 내역 배너는 그리지 않는다.
       쿠폰 할인은 판매가 아래 보유 쿠폰 예상 행만 사용한다.
       리워드·캐시백은 initNaverPayBenefit()이 따로 그린다. */

    function parsePriceNumber(text) {
        const match = String(text || '').match(/\d[\d,]*/);
        return match ? Number(match[0].replace(/,/g, '')) || 0 : 0;
    }

    function formatWon(value) {
        return value.toLocaleString('ko-KR') + '원';
    }

    function getDiscountBreakdownPrices($) {
        const $table = $('.xans-product-detaildesign table').first();
        const $consumerRow = $table.find('tr.prd-consumer-price').not('.displaynone').first();
        const $discountRow = $table.find('tr.prd-best-discount-price').not('.displaynone').first();

        const salePrice = parsePriceNumber($('#span_product_price_text').first().text());
        if (!salePrice) return null;

        const consumerPrice = parsePriceNumber($consumerRow.find('td').first().text());
        const regularPrice = consumerPrice > salePrice ? consumerPrice : salePrice;

        // "22,050원 ( 2,450원 할인)" → 2450
        const couponMatch = $discountRow.find('#span_optimum_discount_price').text().match(/([\d,]+)\s*원\s*할인/);
        const couponDiscount = couponMatch ? parsePriceNumber(couponMatch[1]) : 0;

        return {
            regularPrice: regularPrice,
            memberDiscount: regularPrice - salePrice,
            couponDiscount: couponDiscount,
            finalPrice: Math.max(0, salePrice - couponDiscount)
        };
    }

    // 쿠폰 적용가 금액 앞 할인율 span — (정가 - 최종 구매가) / 정가
    // td > span.coupon-price-group > span.coupon-discount-rate + span(카페24 최적할인가)
    function renderCouponDiscountRate($td, prices) {
        const $group = $td.children('span').first();
        if (!$group.length) return;

        $group.addClass('coupon-price-group');

        const rate = Math.round(((prices.regularPrice - prices.finalPrice) / prices.regularPrice) * 100);
        const $existing = $group.children('.coupon-discount-rate');

        if (rate <= 0) {
            $existing.remove();
            return;
        }
        if ($existing.length && $existing.data('rate') === rate) return;
        $existing.remove();

        $('<span class="coupon-discount-rate"></span>')
            .data('rate', rate)
            .append(document.createTextNode(String(rate)), '<span class="percent-sign">%</span>')
            .prependTo($group);
    }

    function getDiscountBreakdownRowHtml(label, value) {
        return '<div class="discount-breakdown-row">' +
            '<dt>' + label + '</dt>' +
            '<dd>' + value + '</dd>' +
            '</div>';
    }

    function renderDiscountBreakdown($) {
        const $banner = $('#discountBreakdownBanner');
        if (!$banner.length) return;

        $banner.empty().removeData('breakdownKey');
    }

    function initDiscountBreakdown($) {
        const $banner = $('#discountBreakdownBanner');
        if (!$banner.length) return;

        $banner.off('click.discountBreakdown').on('click.discountBreakdown', '.discount-breakdown-head', function () {
            const $toggle = $(this);
            const expanded = $toggle.attr('aria-expanded') !== 'true';

            $toggle.attr('aria-expanded', String(expanded));
            $banner.find('.discount-breakdown-body').prop('hidden', !expanded);
        });

        // 카페24 최적할인가가 늦게 채워지는 경우 대비
        runAtDelays(function () {
            renderDiscountBreakdown($);
        }, [0, 250, 700, 1500]);
    }

    /* 상품요약정보 칩 변환 */
    //   function initSummaryChips($) {
    //     var $summaryValue = $('.xans-product-detaildesign tr.prd-summary td span').first();
    //     if (!$summaryValue.length) return;

    //     var text = $summaryValue.text().trim();
    //     if (!text) return;

    //     var items = text.split(/[,，]\s*/).filter(function (item) {
    //       return item.length > 0;
    //     });
    //     if (!items.length) return;

    //     var $chipWrap = $('<div class="summary-chip-list"></div>');

    //     items.forEach(function (item, index) {
    //       var colorIndex = (index % SUMMARY_CHIP_COLOR_COUNT) + 1;
    //       $('<span></span>')
    //         .addClass('summary-chip summary-chip--color' + colorIndex)
    //         .text(item)
    //         .appendTo($chipWrap);
    //     });

    //     $summaryValue.replaceWith($chipWrap);
    //   }

    /* 상세 탭 강제 전체 표시 + 클릭 시 스크롤 이동 + 스크롤 시 활성 탭 동기화 */
    function initDetailTabScroll($) {
        const $tabProduct = $('#tabProduct');
        if (!$tabProduct.length) return;

        const $tabLinks = $tabProduct.find('a[href^="#"]');
        let $panels = $();
        const panelToLink = {};

        $tabLinks.each(function () {
            const href = $(this).attr('href');
            const $target = $(href);
            if ($target.length) {
                $panels = $panels.add($target);
                panelToLink[href] = this;
            }
        });

        // 모든 섹션 항상 펼쳐서 표시
        $panels.each(function () {
            this.style.setProperty('display', 'block', 'important');
        });

        let isProgrammaticScroll = false;
        let programmaticScrollTimer = null;

        function setSelectedByLink(link) {
            $tabLinks.closest('li').removeClass('selected');
            $(link).closest('li').addClass('selected');
        }

        // 클릭 시 스크롤 이동
        $tabLinks.off('click.detailTabScroll').on('click.detailTabScroll', function (event) {
            const href = $(this).attr('href');
            const $target = $(href);
            if (!$target.length) return;

            event.preventDefault();

            setSelectedByLink(this);
            isProgrammaticScroll = true;
            window.clearTimeout(programmaticScrollTimer);

            $('html, body').animate(
                { scrollTop: $target.offset().top - DETAIL_TAB_SCROLL_OFFSET },
                400,
                function () {
                    programmaticScrollTimer = window.setTimeout(function () {
                        isProgrammaticScroll = false;
                    }, SCROLL_SPY_ANIMATION_GUARD_MS - 400);
                }
            );

            if (typeof removePagingArea === 'function') {
                removePagingArea(href);
            }
        });

        if (typeof IntersectionObserver === 'undefined') return;

        let scrollSpyObserver = $tabProduct.data('detailTabScrollSpy');
        if (scrollSpyObserver) scrollSpyObserver.disconnect();

        scrollSpyObserver = new IntersectionObserver(
            function (entries) {
                if (isProgrammaticScroll) return;

                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) return;

                    const href = '#' + entry.target.id;
                    const link = panelToLink[href];
                    if (link) setSelectedByLink(link);
                });
            },
            {
                rootMargin: '-' + DETAIL_TAB_SCROLL_OFFSET + 'px 0px -60% 0px',
                threshold: 0
            }
        );
        $tabProduct.data('detailTabScrollSpy', scrollSpyObserver);

        $panels.each(function () {
            scrollSpyObserver.observe(this);
        });
        if (typeof removePagingArea === 'function') {
            removePagingArea('#prdReview');
            removePagingArea('#prdQnA');
        }
    }
})();