$(function () {
    $('.period-toggle').on('click', function () {
        var $button = $(this);
        var $periodSearch = $button.closest('.period-search');
        var isOpen = $periodSearch
            .toggleClass('is-open')
            .hasClass('is-open');

        $button.attr('aria-expanded', isOpen);
    });
});