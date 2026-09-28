/// Данные продавца — ЕДИНСТВЕННОЕ место, откуда их берут реквизиты, оферта, контакты и подвал.
/// Эквайер (Freedom Pay) при проверке сайта смотрит: контакты, описание и цены товаров, реквизиты ИП/организации,
/// условия оказания услуг и возврата. null — ещё не заполнено владельцем: на страницах показывается «будет указано»
/// и предупреждение, что документ не действует.
export interface Seller {
  /** Название магазина/проекта в документах. */
  brand: string
  /** «Индивидуальный предприниматель», «ТОО», «Самозанятый». */
  legalForm: string | null
  /** ФИО ИП или наименование организации. */
  name: string | null
  /** ИИН (ИП, 12 цифр) или БИН (организация). */
  iin: string | null
  /** Адрес регистрации. */
  address: string | null
  email: string | null
  phone: string | null
  telegram: string | null
  discord: string
  /** Когда отвечает поддержка. */
  supportHours: string
}

export const SELLER: Seller = {
  brand: 'Wise Store',
  legalForm: 'ИП',
  name: 'Cyrex',
  // ИИН публикуется с 28.09 — реквизиты для эквайера (Freedom Pay)
  iin: '080207554329',
  address: 'Казахстан, г. Алматы, проспект Абылай Хана 93/95',
  email: 'wisepvp.support@gmail.com',
  // телефон публикуется с 28.09 — требование эквайера (Freedom Pay) к контактам
  phone: '+7 776 918 16 18',
  telegram: null,
  discord: 'https://discord.gg/GvwpxwJCY',
  supportHours: 'ежедневно с 10:00 до 22:00 (Астана, UTC+5)',
}

/// Обязательные поля заполнены?
export const SELLER_COMPLETE = [SELLER.legalForm, SELLER.name, SELLER.address, SELLER.email].every(Boolean)

export const PENDING = 'будет указано'

/// «ИП Иванов Иван Иванович» / «ТОО …» для подвала и шапок документов.
export function sellerTitle(): string {
  return SELLER.legalForm && SELLER.name ? `${SELLER.legalForm} ${SELLER.name}` : `Продавец: ${PENDING}`
}
