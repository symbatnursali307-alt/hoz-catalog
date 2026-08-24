export function isAdminOrdersVisible() {
  return process.env.ADMIN_ORDERS_VISIBLE?.trim().toLowerCase() === 'true';
}
