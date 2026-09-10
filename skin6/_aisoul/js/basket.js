$(function () {
    var itemCheckboxSelector = '.ec-base-prdInfo.gCheck > .prdBox > input.check';
    var selectAllSelector = '#product_select_all';
    var isSelectAllChanging = false;
    var syncTimer = null;

    function updateSelectAllCheckbox() {
        var $itemCheckboxes = $(itemCheckboxSelector);
        var checkedCount = $itemCheckboxes.filter(':checked').length;

        var isAllChecked = $itemCheckboxes.length > 0 && checkedCount === $itemCheckboxes.length;
        $(selectAllSelector).prop('checked', isAllChecked).attr('data-status', isAllChecked ? 'on' : 'off');
    }
    document.addEventListener('click',function (event) {
            if (!event.target.matches(selectAllSelector)) {
                return;
            }
            isSelectAllChanging = true;
            clearTimeout(syncTimer);
            syncTimer = setTimeout(function () {
                isSelectAllChanging = false;
                updateSelectAllCheckbox();
            }, 0);
        }, true
    );
    $(document).on('change.basketSelectAll',
        itemCheckboxSelector,function () {
            if (isSelectAllChanging) {
                return;
            }
            clearTimeout(syncTimer);
            syncTimer = setTimeout(function () {
                updateSelectAllCheckbox();
            }, 0);
        }
    );

    updateSelectAllCheckbox();
});