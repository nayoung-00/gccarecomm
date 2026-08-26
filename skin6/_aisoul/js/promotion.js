(function () {
    // 페이지당 노출 개수: 현재 테스트용 2개 노출
    var ITEMS_PER_PAGE = 2;

    var currentFilter = 'all';
    var currentPage = 1;
    var searchKeyword = '';
    var renderTimer = null;

    function initPromotionList() {
        var section = document.querySelector('.promotion-list');
        var promotions = section && section.querySelector('.promotions');
        var bannerContainer = section && section.querySelector('[df-banner-code="promotion-list"]');
        var searchInput = section && section.querySelector('.promotion-search-input');
        var searchButton = section && section.querySelector('.promotion-search-button');

        if (!section || !promotions || !bannerContainer) { return; }

        function getToday() {
            var now = new Date();

            return new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate()
            );
        }

        function parseDate(value) {
            var match = String(value).match(
                /(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/
            );

            if (!match) { return null; }

            var year = Number(match[1]);
            var month = Number(match[2]) - 1;
            var day = Number(match[3]);
            var date = new Date(year, month, day);

            if (
                date.getFullYear() !== year ||
                date.getMonth() !== month ||
                date.getDate() !== day
            ) { return null; }
            return date;
        }

        function getPromotionStatus(item) {
            var dateElement = item.querySelector('.promo-date');
            var dateValues;
            var startDate;
            var endDate;
            var today;

            if (!dateElement) { return 'invalid'; }
            dateValues = dateElement.textContent.match(/\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}/g);
            if (!dateValues || dateValues.length < 2) { return 'invalid'; }

            startDate = parseDate(dateValues[0]);
            endDate = parseDate(dateValues[1]);
            today = getToday();

            if (!startDate || !endDate || startDate > endDate) { return 'invalid'; }
            if (today < startDate) { return 'scheduled'; }
            if (today <= endDate) { return 'ongoing'; }

            return 'ended';
        }

        function getPromotionItems() {
            return Array.prototype.filter.call(
                bannerContainer.querySelectorAll('a[df-banner-clone]'),
                function (item) {
                    return item.querySelector('.promo-date');
                }
            );
        }

        function isMatchingTitle(item) {
            var titleElement = item.querySelector('.promo-title');
            var title;
            if (!searchKeyword) { return true; }
            if (!titleElement) { return false; }

            title = titleElement.textContent.replace(/\s+/g, ' ').trim().toLowerCase();

            return title.indexOf(searchKeyword) !== -1;
        }

        function getFilteredItems(items) {
            return items.filter(function (item) {
                var status = getPromotionStatus(item);
                var matchesFilter;

                item.setAttribute('data-promotion-status', status);

                if (status === 'scheduled' || status === 'invalid') {
                    return false;
                }

                matchesFilter =
                    currentFilter === 'all' ||
                    status === currentFilter;

                return matchesFilter && isMatchingTitle(item);
            });
        }

        function renderEmptyState(show) {
            var emptyElement = promotions.querySelector('.promotion-empty');
            var searchArea = promotions.querySelector('.promotion-search');

            if (!emptyElement) {
                emptyElement = document.createElement('p');
                emptyElement.className = 'promotion-empty';
                emptyElement.textContent = '검색 결과가 없습니다.';

                promotions.insertBefore(
                    emptyElement,
                    searchArea || null
                );
            }

            emptyElement.style.display = show ? 'block' : 'none';
        }

        function createPaginationButton(options) {
            var button = document.createElement('button');
            var arrowTemplate;
            var screenReaderText;

            button.type = 'button';
            button.disabled = options.disabled;

            if (options.className) {
                options.className.split(' ').forEach(function (className) {
                    button.classList.add(className);
                });
            }

            if (options.active) {
                button.classList.add('is-active');
                button.setAttribute('aria-current', 'page');
            }

            if (options.arrowLabel) {
                screenReaderText = document.createElement('i');
                screenReaderText.className = 'sr-only';
                screenReaderText.textContent = options.arrowLabel;
                button.appendChild(screenReaderText);

                arrowTemplate = document.getElementById(
                    'promotion-pagination-arrow-template'
                );

                if (arrowTemplate) {
                    button.insertAdjacentHTML(
                        'beforeend',
                        arrowTemplate.innerHTML
                    );
                }
            } else {
                button.textContent = options.text;
                button.setAttribute(
                    'aria-label',
                    options.text + '페이지'
                );
            }

            button.addEventListener('click', function () {
                if (options.disabled || currentPage === options.page) {
                    return;
                }

                currentPage = options.page;
                render();
                scrollToListTop();
            });

            return button;
        }

        function renderPagination(totalItems) {
            var existingPagination = section.querySelector('.promotion-pagination');
            var totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
            var pagination;
            var page;

            if (existingPagination) {
                existingPagination.remove();
            }

            if (totalPages <= 1) {
                return;
            }

            pagination = document.createElement('div');
            pagination.className = 'promotion-pagination';

            pagination.appendChild(
                createPaginationButton({
                    page: currentPage - 1,
                    disabled: currentPage === 1,
                    active: false,
                    arrowLabel: '이전 페이지',
                    className: 'pagination-arrow paging-btn paging-prev-button'
                })
            );

            for (page = 1; page <= totalPages; page += 1) {
                pagination.appendChild(
                    createPaginationButton({
                        text: String(page),
                        page: page,
                        disabled: false,
                        active: currentPage === page
                    })
                );
            }

            pagination.appendChild(
                createPaginationButton({
                    page: currentPage + 1,
                    disabled: currentPage === totalPages,
                    active: false,
                    arrowLabel: '다음 페이지',
                    className: 'pagination-arrow paging-btn paging-next-button'
                })
            );

            section.appendChild(pagination);
        }

        function scrollToListTop() {
            var top = section.getBoundingClientRect().top + window.pageYOffset - 20;
            window.scrollTo({
                top: top,
                behavior: 'smooth'
            });
        }

        function render() {
            var items = getPromotionItems();
            var filteredItems;
            var totalPages;
            var startIndex;
            var endIndex;

            if (!items.length) {
                return;
            }

            filteredItems = getFilteredItems(items);
            totalPages = Math.ceil(
                filteredItems.length / ITEMS_PER_PAGE
            );

            if (totalPages > 0 && currentPage > totalPages) {
                currentPage = totalPages;
            }

            if (filteredItems.length === 0) {
                currentPage = 1;
            }

            startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
            endIndex = startIndex + ITEMS_PER_PAGE;

            items.forEach(function (item) {
                item.style.display = 'none';
            });

            filteredItems.slice(startIndex, endIndex).forEach(function (item) { item.style.display = ''; });

            renderEmptyState(filteredItems.length === 0);
            renderPagination(filteredItems.length);
        }

        function runSearch() {
            searchKeyword = searchInput
                ? searchInput.value.replace(/\s+/g, ' ').trim().toLowerCase()
                : '';

            currentPage = 1;
            render();
        }

        section.querySelectorAll('[data-promotion-filter]').forEach(function (button) {
            button.addEventListener('click', function () {
                currentFilter = button.getAttribute(
                    'data-promotion-filter'
                );

                currentPage = 1;

                section.querySelectorAll('[data-promotion-filter]').forEach(function (tabButton) {
                    tabButton.classList.remove('is-active');
                });

                button.classList.add('is-active');
                render();
            });
        });

        if (searchButton) {
            searchButton.addEventListener('click', runSearch);
        }

        if (searchInput) {
            searchInput.addEventListener('keydown', function (event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    runSearch();
                }
            });
        }

        function scheduleRender() {
            window.clearTimeout(renderTimer);
            renderTimer = window.setTimeout(render, 100);
        }

        new MutationObserver(scheduleRender).observe(
            bannerContainer,
            {
                childList: true,
                subtree: true
            }
        );

        scheduleRender();
    }

    if (document.readyState === 'loading') {
        document.addEventListener(
            'DOMContentLoaded',
            initPromotionList
        );
    } else {
        initPromotionList();
    }

})();