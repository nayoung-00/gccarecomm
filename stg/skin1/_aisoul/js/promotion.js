(function () {
    // 페이지당 노출 개수
    const ITEMS_PER_PAGE = 4;

    let currentFilter = 'all';
    let currentPage = 1;
    let searchKeyword = '';
    let renderTimer = null;
    let isInitialLoading = true;
    let isFinishingInitialLoading = false;

    function initPromotionList() {
        const section = document.querySelector('.promotion-list');
        const promotions = section && section.querySelector('.promotions');
        const bannerContainer = section && section.querySelector('[df-banner-code="promotion-list"]');
        const searchInput =section && section.querySelector('.promotion-search-input');
        const searchButton = section && section.querySelector('.promotion-search-button');

        if (!section || !promotions || !bannerContainer) { return; }
        function getToday() {
            const now = new Date();

            return new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate()
            );
        }

        function parseDate(value) {
            const match = String(value).match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
            if (!match) { return null;}

            const year = Number(match[1]);
            const month = Number(match[2]) - 1;
            const day = Number(match[3]);
            const date = new Date(year, month, day);
            if (
                date.getFullYear() !== year ||
                date.getMonth() !== month ||
                date.getDate() !== day
            ) {return null;}
            return date;
        }

        function getPromotionStatus(item) {
            const dateElement = item.querySelector('.promo-date');
            let dateValues;
            let startDate;
            let endDate;
            let today;
            if (!dateElement) {return 'invalid';}
            dateValues = dateElement.textContent.match( /\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}/g );
            if (!dateValues || dateValues.length < 2) {return 'invalid';}
            startDate = parseDate(dateValues[0]);
            endDate = parseDate(dateValues[1]);
            today = getToday();
            if (!startDate || !endDate || startDate > endDate) { return 'invalid';}
            if (today < startDate) {return 'scheduled';}
            if (today <= endDate) {return 'ongoing';}
            return 'ended';
        }

        function getPromotionItems() {
            return Array.prototype.filter.call(
                bannerContainer.querySelectorAll(
                    'a[df-banner-clone]'
                ),
                function (item) {
                    return item.querySelector(
                        '.promo-date'
                    );
                }
            );
        }

        function isMatchingTitle(item) {
            const titleElement =
                item.querySelector('.promo-title');

            let title;

            if (!searchKeyword) {
                return true;
            }

            if (!titleElement) {
                return false;
            }

            title =
                titleElement.textContent
                    .replace(/\s+/g, ' ')
                    .trim()
                    .toLowerCase();

            return (
                title.indexOf(searchKeyword) !== -1
            );
        }

        function getFilteredItems(items) {
            return items.filter(function (item) {
                const status =
                    getPromotionStatus(item);

                let matchesFilter;

                item.setAttribute(
                    'data-promotion-status',
                    status
                );

                if (status === 'ended') {
                    item.setAttribute('aria-disabled', 'true');
                } else {
                    item.removeAttribute('aria-disabled');
                }

                if (
                    status === 'scheduled' ||
                    status === 'invalid'
                ) {
                    return false;
                }

                matchesFilter =
                    currentFilter === 'all' ||
                    status === currentFilter;

                return (
                    matchesFilter &&
                    isMatchingTitle(item)
                );
            });
        }

        function renderEmptyState(show) {
            let emptyElement =
                promotions.querySelector(
                    '.promotion-empty'
                );

            if (!emptyElement) {
                emptyElement =
                    document.createElement('p');

                emptyElement.className =
                    'promotion-empty';

                emptyElement.textContent =
                    '검색 결과가 없습니다.';

                promotions.appendChild(
                    emptyElement
                );
            }

            emptyElement.style.display =
                show ? 'block' : 'none';
        }

        function createPaginationButton(options) {
            const button =
                document.createElement('button');

            let arrowTemplate;
            let screenReaderText;

            button.type = 'button';
            button.disabled = options.disabled;

            if (options.className) {
                options.className
                    .split(' ')
                    .forEach(function (className) {
                        button.classList.add(
                            className
                        );
                    });
            }

            if (options.active) {
                button.classList.add(
                    'is-active'
                );

                button.setAttribute(
                    'aria-current',
                    'page'
                );
            }

            if (options.arrowLabel) {
                screenReaderText =
                    document.createElement('i');

                screenReaderText.className =
                    'sr-only';

                screenReaderText.textContent =
                    options.arrowLabel;

                button.appendChild(
                    screenReaderText
                );

                arrowTemplate =
                    document.getElementById(
                        'promotion-pagination-arrow-template'
                    );

                if (arrowTemplate) {
                    button.insertAdjacentHTML(
                        'beforeend',
                        arrowTemplate.innerHTML
                    );
                }
            } else {
                button.textContent =
                    options.text;

                button.setAttribute(
                    'aria-label',
                    options.text + '페이지'
                );
            }

            button.addEventListener(
                'click',
                function () {
                    if (
                        options.disabled ||
                        currentPage ===
                        options.page
                    ) {
                        return;
                    }

                    currentPage = options.page;

                    render();
                    scrollToListTop();
                }
            );

            return button;
        }

        function renderPagination(totalItems) {
            const existingPagination =
                section.querySelector(
                    '.promotion-pagination'
                );

            const totalPages =
                Math.ceil(
                    totalItems /
                    ITEMS_PER_PAGE
                );

            let pagination;
            let page;

            if (existingPagination) {
                existingPagination.remove();
            }

            if (totalPages <= 1) {
                return;
            }

            pagination =
                document.createElement('div');

            pagination.className =
                'promotion-pagination';

            pagination.appendChild(
                createPaginationButton({
                    page: currentPage - 1,
                    disabled:
                        currentPage === 1,
                    active: false,
                    arrowLabel: '이전 페이지',
                    className:
                        'pagination-arrow paging-btn paging-prev-button'
                })
            );

            for (
                page = 1;
                page <= totalPages;
                page += 1
            ) {
                pagination.appendChild(
                    createPaginationButton({
                        text: String(page),
                        page: page,
                        disabled: false,
                        active:
                            currentPage === page
                    })
                );
            }

            pagination.appendChild(
                createPaginationButton({
                    page: currentPage + 1,
                    disabled:
                        currentPage === totalPages,
                    active: false,
                    arrowLabel: '다음 페이지',
                    className:
                        'pagination-arrow paging-btn paging-next-button'
                })
            );

            section.appendChild(
                pagination
            );
        }

        function scrollToListTop() {
            const top =
                section
                    .getBoundingClientRect()
                    .top +
                window.pageYOffset -
                20;

            window.scrollTo({
                top: top,
                behavior: 'smooth'
            });
        }

        function finishPromotionLoading(items) {
            const imagePromises = [];
            if (!isInitialLoading || isFinishingInitialLoading) {return;}
            isFinishingInitialLoading = true;
            items.forEach(function (item) {
                const image = item.querySelector('img');

                if (!image || image.complete) {return;}

                imagePromises.push(
                    new Promise(function (resolve) {
                        image.addEventListener(
                            'load',
                            resolve,
                            { once: true }
                        );

                        image.addEventListener(
                            'error',
                            resolve,
                            { once: true }
                        );
                    })
                );
            });

            Promise.all(imagePromises).then(
                function () {
                    requestAnimationFrame(
                        function () {
                            requestAnimationFrame(
                                function () {
                                    const skeletonList = section.querySelector('.promotion-skeleton-list');
                                    section.classList.remove('is-promotion-loading');
                                    section.removeAttribute('aria-busy');

                                    if (skeletonList) {skeletonList.remove();}

                                    isInitialLoading = false;
                                    isFinishingInitialLoading = false;
                                }
                            );
                        }
                    );
                }
            );
        }

        function render() {
            const items = getPromotionItems();
            let filteredItems;
            let totalPages;
            let startIndex;
            let endIndex;
            let visibleItems;
            if (!items.length && bannerContainer.hidden) { return;}
            if (!items.length) {
                renderEmptyState(true);
                renderPagination(0);
                if (isInitialLoading) {
                    finishPromotionLoading([]);
                }
                return;
            }
            filteredItems = getFilteredItems(items);
            totalPages = Math.ceil( filteredItems.length / ITEMS_PER_PAGE);
            if (
                totalPages > 0 &&
                currentPage > totalPages
            ) {
                currentPage = totalPages;
            }

            if (
                filteredItems.length === 0
            ) {
                currentPage = 1;
            }

            startIndex =
                (currentPage - 1) *
                ITEMS_PER_PAGE;

            endIndex =
                startIndex +
                ITEMS_PER_PAGE;

            items.forEach(function (item) {
                item.style.display = 'none';
            });

            visibleItems =
                filteredItems.slice(
                    startIndex,
                    endIndex
                );

            visibleItems.forEach(
                function (item) {
                    item.style.display = '';
                }
            );

            renderEmptyState(filteredItems.length === 0);
            renderPagination(filteredItems.length);
            if (isInitialLoading && !bannerContainer.hidden) {
                finishPromotionLoading(
                    visibleItems
                );
            }
        }

        function runSearch() {
            searchKeyword = searchInput
                ? searchInput.value
                    .replace(/\s+/g, ' ')
                    .trim()
                    .toLowerCase()
                : '';

            currentPage = 1;
            render();
        }

        section.querySelectorAll('[data-promotion-filter]')
            .forEach(function (button) {
                button.addEventListener(
                    'click',
                    function () {
                        currentFilter =
                            button.getAttribute(
                                'data-promotion-filter'
                            );

                        currentPage = 1;

                        section.querySelectorAll('[data-promotion-filter]').forEach(
                                function (tabButton) {
                                    tabButton.classList.remove(
                                        'is-active'
                                    );
                                }
                            );
                        button.classList.add('is-active');
                        render();
                    }
                );
            });

        // 종료된 프로모션은 링크 이동 차단
        bannerContainer.addEventListener('click', function (event) {
            const link = event.target.closest('a[data-promotion-status="ended"]');

            if (link) {
                event.preventDefault();
            }
        });

        if (searchButton) {
            searchButton.addEventListener('click',runSearch);
        }

        if (searchInput) {
            searchInput.addEventListener(
                'keydown',
                function (event) {
                    if (
                        event.key === 'Enter'
                    ) {
                        event.preventDefault();
                        runSearch();
                    }
                }
            );
        }

        function scheduleRender() {
            window.clearTimeout(renderTimer);
            renderTimer = window.setTimeout(render, 100);
        }

        new MutationObserver(
            scheduleRender
        ).observe(
            bannerContainer,
            {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: [
                    'hidden'
                ]
            }
        );

        scheduleRender();
    }

    if (
        document.readyState === 'loading'
    ) {
        document.addEventListener(
            'DOMContentLoaded',
            initPromotionList
        );
    } else {
        initPromotionList();
    }
})();