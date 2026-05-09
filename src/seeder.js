const bcrypt = require('bcryptjs');
const prisma  = require('./config/prisma');

async function seed() {
  console.log('🌱 Seeding database...');

  const existingAdmin = await prisma.user.findUnique({ where: { username: 'admin' } });
  if (!existingAdmin) {
    await prisma.user.create({ data: { name: 'Administrator', username: 'admin', password: await bcrypt.hash('admin123', 12), role: 'admin' } });
    console.log('✅ Admin created  →  username: admin | password: admin123');
    console.log('   ⚠️  CHANGE THIS PASSWORD IN PRODUCTION!');
  } else {
    console.log('ℹ️  Admin already exists');
  }

  const existingCashier = await prisma.user.findUnique({ where: { username: 'kasir1' } });
  if (!existingCashier) {
    await prisma.user.create({ data: { name: 'Kasir Satu', username: 'kasir1', password: await bcrypt.hash('kasir123', 12), role: 'cashier' } });
    console.log('✅ Cashier created  →  username: kasir1 | password: kasir123');
  }

  const count = await prisma.product.count();
  if (count === 0) {
    const products = [
      { name: 'Ikan Bandeng Presto Bumbu Bali', description: 'Bandeng presto dengan bumbu Bali khas',    category: 'protein',  price: 45000, stock: 50, unit: 'ekor' },
      { name: 'Ikan Pindang Tongkol',           description: 'Tongkol segar dimasak pindang rempah',     category: 'protein',  price: 35000, stock: 80, unit: 'kg'   },
      { name: 'Ikan Asin Jambal Roti',           description: 'Ikan jambal asin kering berkualitas',      category: 'protein',   price: 60000, stock: 30, unit: 'kg'   },
      { name: 'Ikan Kembung Bumbu Kuning',       description: 'Kembung segar dengan bumbu kuning harum',  category: 'protein',  price: 38000, stock: 60, unit: 'kg'   },
      { name: 'Otak-Otak Ikan Tenggiri',         description: 'Olahan tenggiri dibungkus daun pisang',    category: 'protein', price:  5000, stock:  3, unit: 'pcs'  },
    ];
    for (const p of products) await prisma.product.create({ data: p });
    console.log('✅ ' + products.length + ' sample products seeded (including 1 low-stock item for testing)');
  }

  console.log('🌱 Seeding complete.\n');
}

module.exports = { seed };
