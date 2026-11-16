/**
 * Admin paneli yetkileri. backend/src/routes/admin.routes.js ile aynı kurallar:
 * tüm /admin uçları 'admin' ve 'manager' rollerine açık; restoran ayarlarını
 * değiştirmek ve kullanıcı yönetimi yalnızca 'admin' (işletme sahibi) rolüne açık.
 */
export function adminCan(role) {
  const isOwner = role === 'admin';
  return {
    manageMenu: isOwner || role === 'manager',
    manageTables: isOwner || role === 'manager',
    viewReports: isOwner || role === 'manager',
    viewSettings: isOwner || role === 'manager',
    editSettings: isOwner,
    manageUsers: isOwner,
  };
}
