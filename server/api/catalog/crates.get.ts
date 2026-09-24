/// GET /api/catalog/crates — шансы кейсов для страницы /crates.
/// EasyDonate шансов не знает: они живут в конфиге CratesPlugin на сервере CAT
/// (plugins/CratesPlugin/config.yml → title-crate-chances). Поменяли конфиг — поменяйте здесь.
export default defineEventHandler(() => [
  {
    key: 'title',
    name: 'Титульный кейс',
    items: [
      { itemKey: 'recruit', displayName: 'Recruit', chance: 50 },
      { itemKey: 'warrior', displayName: 'Warrior', chance: 30 },
      { itemKey: 'mage', displayName: 'Mage', chance: 15 },
      { itemKey: 'oldfag', displayName: 'Oldfag', chance: 4 },
      { itemKey: 'hermit', displayName: 'Hermit', chance: 1 },
    ],
  },
])
