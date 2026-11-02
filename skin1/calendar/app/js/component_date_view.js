class Cafe24AppCalendarDateView extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    CAC.currentElement = this;
    CAC_UTIL.setMomentLocale()

    CAC_UTIL.is_mobile = document.documentElement.clientWidth <= 766;

    if (window.top !== window.self) {
      CAC_UTIL.observeTopAppBody();
    }
  }
  async connectedCallback() {
    // set moment locale
    if (CAC_UTIL.isEcEditor() && document.querySelectorAll('cafe24-app-calendar').length > 1) {
      alert('한 페이지에 한 개의 캘린더만 추가할 수 있습니다.');
      return;
    }
    this.shadowRoot.innerHTML = '';
    await this.render();
  }

  async render() {
    const [swiperStyle, resetStyle, calendarStyle, froalaStyle] = await Promise.all([
      CAC_UTIL.loadCSS('https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css'),
      CAC_UTIL.loadCSS('/calendar/app/css/list/reset.css'),
      CAC_UTIL.loadCSS('/calendar/app/css/list/common.css'),
      CAC_UTIL.loadCSS('/calendar/app/css/froala_style.min.css'),
    ]);

    this.shadowRoot.appendChild(swiperStyle);
    this.shadowRoot.appendChild(resetStyle);
    this.shadowRoot.appendChild(calendarStyle);
    this.shadowRoot.appendChild(froalaStyle);
    const template = CAC_UTIL.isMobile()
      ? document.getElementById('calendar-app-template-date-view-mo').content
      : document.getElementById('calendar-app-template-date-view-pc').content;
    this.shadowRoot.appendChild(template.cloneNode(true));

    await CAC_LIST_START();
  }
}
