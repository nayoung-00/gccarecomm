const initCalendar = async function () {
  const WebComponentMap = {
    month_view: Cafe24AppCalendar, // 달력형
    date_view: Cafe24AppCalendarDateView, // 리스트형 날자
    img_view: Cafe24AppCalendarImgView, // 리스트형 이미지
    prd_view: Cafe24AppCalendarPrdView, // 리스트형 상품
  };

  const groupId = document.querySelector('cafe24-app-calendar').getAttribute('group-id');

  const setting = await CAC_CAFE24API.getSetting();

  let currentGroup = null;
  if(!!groupId) {
    currentGroup = setting?.group_list.find((group) => group._id === groupId)?.single_calendar_front_calendar_view_type;
  } else {
    currentGroup = setting?.basic_setting?.front_calendar_view_type
  }

  customElements.define('cafe24-app-calendar', WebComponentMap[currentGroup]);
};

initCalendar().catch((e) => {
  // 초기화 에러기 기본 캘린더 노출
  customElements.define('cafe24-app-calendar', Cafe24AppCalendar);
});
