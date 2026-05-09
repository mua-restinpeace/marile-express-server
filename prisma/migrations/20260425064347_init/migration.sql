-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` ENUM('admin', 'cashier') NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(512) NOT NULL,
    `expired_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refresh_tokens_token_key`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `products` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `category` ENUM('sayur', 'protein', 'buah', 'lainnya') NOT NULL,
    `price` DECIMAL(12, 2) NOT NULL,
    `stock` DECIMAL(10, 3) NOT NULL DEFAULT 0,
    `unit` ENUM('kg', 'pcs', 'ekor') NOT NULL DEFAULT 'kg',
    `image_url` VARCHAR(191) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transactions` (
    `id` VARCHAR(191) NOT NULL,
    `cashierId` VARCHAR(191) NOT NULL,
    `invoice_no` VARCHAR(191) NOT NULL,
    `payment_method` ENUM('Cash', 'Qris', 'BankTransfer') NOT NULL DEFAULT 'Cash',
    `total` DECIMAL(12, 2) NOT NULL,
    `amount_paid` DECIMAL(12, 2) NOT NULL,
    `change` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('completed', 'canceled') NOT NULL DEFAULT 'completed',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `transactions_invoice_no_key`(`invoice_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transaction_items` (
    `id` VARCHAR(191) NOT NULL,
    `transactionsId` VARCHAR(191) NOT NULL,
    `productsId` VARCHAR(191) NOT NULL,
    `product_name` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(10, 3) NOT NULL,
    `unit_price` DECIMAL(12, 2) NOT NULL,
    `sub_total` DECIMAL(12, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_logs` (
    `id` VARCHAR(191) NOT NULL,
    `productsId` VARCHAR(191) NOT NULL,
    `created_by` VARCHAR(191) NULL,
    `type` ENUM('restock', 'sale', 'adjustment', 'void') NOT NULL,
    `note` VARCHAR(191) NULL,
    `quantity` DECIMAL(10, 3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_cashierId_fkey` FOREIGN KEY (`cashierId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transaction_items` ADD CONSTRAINT `transaction_items_productsId_fkey` FOREIGN KEY (`productsId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transaction_items` ADD CONSTRAINT `transaction_items_transactionsId_fkey` FOREIGN KEY (`transactionsId`) REFERENCES `transactions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_logs` ADD CONSTRAINT `inventory_logs_productsId_fkey` FOREIGN KEY (`productsId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_logs` ADD CONSTRAINT `inventory_logs_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
