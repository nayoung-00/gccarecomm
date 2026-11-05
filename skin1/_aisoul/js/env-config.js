(function () {
    if (window.GC_ENV && window.GC_PRODUCT_API) return;

    // gc.aisoul.co.kr 은 기존 detail.js 판별식에만 있다.
    // 실제 페이지 호스트로 확인되기 전에는 등록하지 않는다.
    var HOSTS = {
        'gccarecomm.cafe24.com': 'production',
        'gccarecommstg.cafe24.com': 'staging'
    };

    var ENVIRONMENTS = {
        production: {
            allProductsCategoryNo: '47',
            headerEntryCategoryNos: ['50', '51'],
            productApi: {
                baseUrl: 'https://cafe24.howcare.co.kr/api/products',
                fetchOptions: {}
            },
            bannerScripts: {
                main: {
                    id: 'dfbm-script-71068',
                    src: 'https://ecimg.cafe24img.com/pg3115b02085582078/gccarecomm/web/upload/appfiles/ZaReJam3QiELznoZeGGkMG/1b95423be3bf52a732ce1ef3ff6db0e6.js'
                },
                promotionList: {
                    id: 'dfbm-script-71775',
                    src: 'https://ecimg.cafe24img.com/pg3115b02085582078/gccarecomm/web/upload/appfiles/ZaReJam3QiELznoZeGGkMG/0f9ee1e8edb403e071664c4b57fb3507.js'
                }
            }
        },
        staging: {
            allProductsCategoryNo: '23',
            headerEntryCategoryNos: ['42', '43'],
            productApi: {
                baseUrl: 'https://stg-cafe24.howcare.co.kr/api/products',
                fetchOptions: {}
            },
            bannerScripts: {
                main: {
                    id: 'dfbm-script-73980',
                    src: 'https://ecimg.cafe24img.com/pg3481b81734614017/gccarecommstg/web/upload/appfiles/ZaReJam3QiELznoZeGGkMG/ab0c4b0e1e6b44cf90ca013bd0a89571.js'
                },
                promotionList: {
                    id: 'dfbm-script-73981',
                    src: 'https://ecimg.cafe24img.com/pg3481b81734614017/gccarecommstg/web/upload/appfiles/ZaReJam3QiELznoZeGGkMG/04117a5df34ef3765a71d55618365793.js'
                }
            }
        }
    };

    var unknownHostWarned = false;

    function readEnvironment() {
        var env = ENVIRONMENTS[HOSTS[window.location.hostname]];

        if (!env) {
            if (!unknownHostWarned) {
                unknownHostWarned = true;
                console.warn('[GC_PRODUCT_API] 등록되지 않은 호스트:', window.location.hostname);
            }
            return null;
        }

        return env;
    }

    if (!window.GC_ENV) {
        window.GC_ENV = {
            get: readEnvironment
        };
    }

    if (!window.GC_PRODUCT_API) {
        window.GC_PRODUCT_API = {
            getConfig: function () {
                var env = window.GC_ENV && typeof window.GC_ENV.get === 'function'
                    ? window.GC_ENV.get()
                    : null;
                return env ? env.productApi : null;
            }
        };
    }
})();
