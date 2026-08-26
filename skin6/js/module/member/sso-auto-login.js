(function (window, document) {
    'use strict';

    var AUTO_LOGIN_PARAM = 'gc_sso_auto';
    var BUTTON_ID = 'gcSsoLogin';
    var STATUS_ID = 'gcSsoAutoLoginStatus';
    var RETRY_LIMIT = 30;
    var RETRY_INTERVAL_MS = 100;
    var LOOP_GUARD_MS = 10000;
    var LOOP_GUARD_KEY = 'gc_sso_auto_login_started_at';

    function isAutoLoginRequest() {
        try {
            return new URL(window.location.href).searchParams.get(AUTO_LOGIN_PARAM) === '1';
        } catch (error) {
            return false;
        }
    }

    function statusElement() {
        return document.getElementById(STATUS_ID);
    }

    function loginForm() {
        var button = document.getElementById(BUTTON_ID);

        if (button && typeof button.closest === 'function') {
            return button.closest('fieldset');
        }
        return document.querySelector('[module="member_login"] fieldset');
    }

    function showAutoLoginView(message) {
        var status = statusElement();
        var form = loginForm();
        if (form) {
            form.style.opacity = '0';
            form.style.pointerEvents = 'none';
            form.setAttribute('aria-hidden', 'true');
        }
        if (status) {
            status.hidden = false;
            status.textContent = message;
        }
    }

    function showFallback(message) {
        var status = statusElement();
        var form = loginForm();

        if (form) {
            form.style.opacity = '';
            form.style.pointerEvents = '';
            form.removeAttribute('aria-hidden');
        }
        if (status) {
            status.hidden = false;
            status.textContent = message;
        }
    }

    function wasStartedRecently() {
        try {
            var startedAt = Number(window.sessionStorage.getItem(LOOP_GUARD_KEY));
            return Number.isFinite(startedAt)
                && Date.now() - startedAt < LOOP_GUARD_MS;
        } catch (error) {
            return false;
        }
    }

    function rememberStart() {
        try {
            window.sessionStorage.setItem(LOOP_GUARD_KEY, String(Date.now()));
        } catch (error) {
            // Storage가 차단되어도 Cafe24 SSO 자체는 계속 진행한다.
        }
    }

    function clickSsoButton(attempt) {
        var button = document.getElementById(BUTTON_ID);

        if (!button && attempt < RETRY_LIMIT) {
            window.setTimeout(function () {
                clickSsoButton(attempt + 1);
            }, RETRY_INTERVAL_MS);
            return;
        }
        if (!button || !button.getAttribute('onclick')) {
            showFallback('SSO 로그인을 시작할 수 없습니다. SSO 로그인 버튼을 확인해 주세요.');
            return;
        }

        rememberStart();
        showAutoLoginView('로그인 처리 중입니다. 잠시만 기다려 주세요.');
        button.click();

        window.setTimeout(function () {
            if (document.visibilityState === 'visible') {
                showFallback('자동 로그인이 지연되고 있습니다. SSO 로그인 버튼을 눌러 다시 시도해 주세요.');
            }
        }, 8000);
    }

    function start() {
        if (!isAutoLoginRequest()) {
            return;
        }
        if (wasStartedRecently()) {
            showFallback('자동 로그인 재실행을 중단했습니다. SSO 로그인 버튼을 눌러 다시 시도해 주세요.');
            return;
        }
        showAutoLoginView('로그인 준비 중입니다.');
        clickSsoButton(0);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
}(window, document));
