const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
const PORT = 3456;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ==================== Helper ====================
async function getConnection(config) {
  return await mysql.createConnection({
    host: config.hostname,
    port: config.port || 3306,
    user: config.username,
    password: config.password || '',
    database: config.db,
    charset: 'utf8mb4',
  });
}

// ==================== Routes ====================
app.post('/api/mysql-manager', async (req, res) => {
  const { action, connection } = req.body;

  if (!connection || !connection.hostname || !connection.username || !connection.db) {
    return res.status(400).json({ error: 'بيانات الاتصال غير مكتملة' });
  }

  try {
    switch (action) {
      case 'test-connection':
        return res.json(await testConnection(connection));
      case 'create-schema':
        return res.json(await createSchema(connection));
      case 'delete-all-data':
        return res.json(await deleteAllData(connection));
      case 'drop-all-tables':
        return res.json(await dropAllTables(connection));
      default:
        return res.status(400).json({ error: `عملية غير معروفة: ${action}` });
    }
  } catch (error) {
    console.error('Error:', error.message);
    return res.status(500).json({ error: error.message || 'حدث خطأ غير متوقع' });
  }
});

// ==================== Actions ====================
async function testConnection(config) {
  const conn = await getConnection(config);
  await conn.query('SELECT 1 as test');
  await conn.end();
  return { success: true, message: 'تم الاتصال بنجاح بقاعدة البيانات' };
}

async function createSchema(config) {
  const conn = await getConnection(config);
  const statements = getMySQLSchema();
  const triggerStatements = getMySQLTriggers();
  const results = [];

  for (const stmt of statements) {
    const trimmed = stmt.trim();
    if (!trimmed) continue;
    try {
      await conn.execute(trimmed);
      const match = trimmed.match(/CREATE TABLE IF NOT EXISTS `?(\w+)`?/i);
      if (match) {
        results.push(`✅ تم إنشاء جدول: ${match[1]}`);
      }
    } catch (e) {
      const tableMatch = trimmed.match(/CREATE TABLE IF NOT EXISTS `?(\w+)`?/i);
      results.push(`⚠️ ${tableMatch ? tableMatch[1] : 'SQL'}: ${e.message}`);
    }
  }

  // Create triggers
  for (const triggerSQL of triggerStatements) {
    const trimmed = triggerSQL.trim();
    if (!trimmed) continue;
    try {
      await conn.execute(trimmed);
      const nameMatch = trimmed.match(/CREATE TRIGGER\s+(\w+)/i);
      results.push(`✅ تم إنشاء trigger: ${nameMatch ? nameMatch[1] : 'unknown'}`);
    } catch (e) {
      if (e.message?.includes('already exists')) {
        const nameMatch = trimmed.match(/CREATE TRIGGER\s+(\w+)/i);
        results.push(`ℹ️ trigger موجود مسبقاً: ${nameMatch ? nameMatch[1] : ''}`);
      } else {
        const nameMatch = trimmed.match(/CREATE TRIGGER\s+(\w+)/i);
        results.push(`⚠️ trigger ${nameMatch ? nameMatch[1] : ''}: ${e.message}`);
      }
    }
  }

  await conn.end();
  return { success: true, message: 'تم إنشاء هيكل قاعدة البيانات مع الـ Triggers', details: results };
}

async function deleteAllData(config) {
  const conn = await getConnection(config);
  await conn.execute('SET FOREIGN_KEY_CHECKS = 0');

  const [tables] = await conn.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_type = 'BASE TABLE'`,
    [config.db]
  );

  const results = [];
  for (const row of tables) {
    const tableName = row.TABLE_NAME || row.table_name;
    try {
      await conn.execute(`TRUNCATE TABLE \`${tableName}\``);
      results.push(`✅ تم حذف بيانات: ${tableName}`);
    } catch (e) {
      results.push(`⚠️ ${tableName}: ${e.message}`);
    }
  }

  await conn.execute('SET FOREIGN_KEY_CHECKS = 1');
  await conn.end();
  return { success: true, message: `تم حذف بيانات ${results.length} جدول`, details: results };
}

async function dropAllTables(config) {
  const conn = await getConnection(config);
  await conn.execute('SET FOREIGN_KEY_CHECKS = 0');

  const [tables] = await conn.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_type = 'BASE TABLE'`,
    [config.db]
  );

  const results = [];
  for (const row of tables) {
    const tableName = row.TABLE_NAME || row.table_name;
    try {
      await conn.execute(`DROP TABLE IF EXISTS \`${tableName}\``);
      results.push(`✅ تم حذف جدول: ${tableName}`);
    } catch (e) {
      results.push(`⚠️ ${tableName}: ${e.message}`);
    }
  }

  await conn.execute('SET FOREIGN_KEY_CHECKS = 1');
  await conn.end();
  return { success: true, message: `تم حذف ${results.length} جدول`, details: results };
}

// ==================== Schema ====================
function getMySQLSchema() {
  return [
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      user_id CHAR(36) NULL,
      table_name VARCHAR(255) NOT NULL,
      record_id VARCHAR(255) NOT NULL,
      action VARCHAR(50) NOT NULL,
      user_email VARCHAR(255) NULL,
      old_data JSON NULL,
      new_data JSON NULL,
      changed_fields JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS clients (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(50) NULL,
      email VARCHAR(255) NULL,
      city VARCHAR(255) NULL,
      address TEXT NULL,
      notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS company_settings (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      company_name VARCHAR(255) NOT NULL DEFAULT 'شركة',
      company_logo TEXT NULL,
      theme_color VARCHAR(50) NULL,
      image_upload_provider VARCHAR(50) NOT NULL DEFAULT 'imgbb',
      imgbb_api_key VARCHAR(255) NULL,
      freeimage_api_key VARCHAR(255) NULL,
      cloudinary_cloud_name VARCHAR(255) NULL,
      cloudinary_api_key VARCHAR(255) NULL,
      cloudinary_upload_preset VARCHAR(255) NULL,
      postimages_api_key VARCHAR(255) NULL,
      print_labels JSON NULL,
      print_title_font_size INT NULL,
      print_header_font_size INT NULL,
      print_table_font_size INT NULL,
      print_header_text_color VARCHAR(20) NULL,
      print_table_header_color VARCHAR(20) NULL,
      print_table_row_odd_color VARCHAR(20) NULL,
      print_table_row_even_color VARCHAR(20) NULL,
      print_table_text_color VARCHAR(20) NULL,
      print_table_border_color VARCHAR(20) NULL,
      print_section_title_color VARCHAR(20) NULL,
      print_border_width INT NULL,
      print_border_radius INT NULL,
      print_cell_padding INT NULL,
      contract_logo_position VARCHAR(50) NULL,
      contract_accent_color VARCHAR(20) NULL,
      contract_show_project_info BOOLEAN NULL DEFAULT TRUE,
      contract_show_items_table BOOLEAN NULL DEFAULT TRUE,
      contract_show_description BOOLEAN NULL DEFAULT TRUE,
      contract_show_clauses BOOLEAN NULL DEFAULT TRUE,
      contract_show_signatures BOOLEAN NULL DEFAULT TRUE,
      contract_title_text VARCHAR(255) NULL,
      contract_font_size_title INT NULL,
      contract_font_size_body INT NULL,
      contract_signature_labels JSON NULL,
      contract_background TEXT NULL,
      contract_bg_pos_x_mm DECIMAL(10,2) NULL,
      contract_bg_pos_y_mm DECIMAL(10,2) NULL,
      contract_bg_scale_percent DECIMAL(10,2) NULL,
      contract_padding_top_mm DECIMAL(10,2) NULL,
      contract_padding_bottom_mm DECIMAL(10,2) NULL,
      contract_padding_left_mm DECIMAL(10,2) NULL,
      contract_padding_right_mm DECIMAL(10,2) NULL,
      contract_header_bg_color VARCHAR(20) NULL,
      contract_header_text_color VARCHAR(20) NULL,
      contract_footer_enabled BOOLEAN NULL DEFAULT FALSE,
      contract_footer_height_mm DECIMAL(10,2) NULL,
      contract_footer_bottom_mm DECIMAL(10,2) NULL,
      report_background TEXT NULL,
      report_bg_pos_x_mm DECIMAL(10,2) NULL,
      report_bg_pos_y_mm DECIMAL(10,2) NULL,
      report_bg_scale_percent DECIMAL(10,2) NULL,
      report_padding_top_mm DECIMAL(10,2) NULL,
      report_padding_bottom_mm DECIMAL(10,2) NULL,
      report_padding_left_mm DECIMAL(10,2) NULL,
      report_padding_right_mm DECIMAL(10,2) NULL,
      report_footer_enabled BOOLEAN NULL DEFAULT FALSE,
      report_footer_height_mm DECIMAL(10,2) NULL,
      report_footer_bottom_mm DECIMAL(10,2) NULL,
      report_content_max_height_mm DECIMAL(10,2) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS contract_clause_templates (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      title VARCHAR(500) NOT NULL,
      content TEXT NOT NULL,
      category VARCHAR(100) NOT NULL DEFAULT 'general',
      order_index INT NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS employees (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(50) NULL,
      email VARCHAR(255) NULL,
      position VARCHAR(255) NULL,
      department VARCHAR(255) NULL,
      hire_date DATE NULL,
      salary DECIMAL(18,4) NULL,
      notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS engineers (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NULL,
      phone VARCHAR(50) NULL,
      specialty VARCHAR(255) NULL,
      license_number VARCHAR(100) NULL,
      engineer_type VARCHAR(50) NOT NULL DEFAULT 'resident',
      notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS equipment (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      category VARCHAR(255) NULL,
      serial_number VARCHAR(255) NULL,
      current_condition VARCHAR(50) NOT NULL DEFAULT 'good',
      purchase_date DATE NULL,
      purchase_price DECIMAL(18,4) NOT NULL DEFAULT 0,
      daily_rental_rate DECIMAL(18,4) NOT NULL DEFAULT 0,
      total_quantity INT NOT NULL DEFAULT 1,
      available_quantity INT NOT NULL DEFAULT 1,
      image_url TEXT NULL,
      notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS materials (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      name VARCHAR(255) NOT NULL,
      unit VARCHAR(50) NOT NULL DEFAULT 'وحدة',
      category VARCHAR(255) NULL,
      min_stock_level DECIMAL(18,4) NOT NULL DEFAULT 0,
      current_stock DECIMAL(18,4) NOT NULL DEFAULT 0,
      unit_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
      notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS measurement_configs (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      name VARCHAR(255) NOT NULL,
      unit_symbol VARCHAR(50) NOT NULL,
      formula TEXT NULL,
      components JSON NULL,
      is_default BOOLEAN NULL DEFAULT FALSE,
      notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS phase_reference_seq (
      year INT NOT NULL,
      last_number INT NOT NULL DEFAULT 0,
      PRIMARY KEY (year)
    ) ENGINE=InnoDB`,

    `CREATE TABLE IF NOT EXISTS profiles (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      user_id CHAR(36) NOT NULL,
      email VARCHAR(255) NULL,
      display_name VARCHAR(255) NULL,
      username VARCHAR(100) NULL,
      title VARCHAR(255) NULL,
      access_code VARCHAR(10) NULL,
      engineer_id CHAR(36) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_profiles_user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS suppliers (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      name VARCHAR(255) NOT NULL,
      category VARCHAR(255) NULL,
      phone VARCHAR(50) NULL,
      email VARCHAR(255) NULL,
      address TEXT NULL,
      total_purchases DECIMAL(18,4) NULL DEFAULT 0,
      payment_status VARCHAR(50) NULL DEFAULT 'paid',
      notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS technicians (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      name VARCHAR(255) NOT NULL,
      specialty VARCHAR(255) NULL,
      phone VARCHAR(50) NULL,
      email VARCHAR(255) NULL,
      hourly_rate DECIMAL(18,4) NULL,
      daily_rate DECIMAL(18,4) NULL,
      meter_rate DECIMAL(18,4) NULL,
      piece_rate DECIMAL(18,4) NULL,
      notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS treasuries (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      treasury_type VARCHAR(50) NOT NULL DEFAULT 'cash',
      bank_name VARCHAR(255) NULL,
      account_number VARCHAR(100) NULL,
      balance DECIMAL(18,4) NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      parent_id CHAR(36) NULL,
      notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // ===== Dependent tables =====
    `CREATE TABLE IF NOT EXISTS projects (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      client_id CHAR(36) NULL,
      location VARCHAR(500) NULL,
      start_date DATE NULL,
      end_date DATE NULL,
      budget DECIMAL(18,4) NULL,
      budget_type VARCHAR(50) NULL DEFAULT 'fixed',
      spent DECIMAL(18,4) NULL DEFAULT 0,
      progress DECIMAL(10,2) NULL DEFAULT 0,
      status VARCHAR(50) NOT NULL DEFAULT 'active',
      image_url TEXT NULL,
      notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      CONSTRAINT fk_projects_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS user_roles (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      user_id CHAR(36) NOT NULL,
      role ENUM('admin','engineer','accountant','supervisor') NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uk_user_roles (user_id, role)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS treasury_transactions (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      treasury_id CHAR(36) NOT NULL,
      type VARCHAR(50) NOT NULL,
      amount DECIMAL(18,4) NOT NULL DEFAULT 0,
      balance_after DECIMAL(18,4) NOT NULL DEFAULT 0,
      description TEXT NULL,
      reference_id CHAR(36) NULL,
      reference_type VARCHAR(100) NULL,
      date DATE NOT NULL DEFAULT (CURRENT_DATE),
      source VARCHAR(100) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      CONSTRAINT fk_tt_treasury FOREIGN KEY (treasury_id) REFERENCES treasuries(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS project_phases (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      project_id CHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      order_index INT NOT NULL DEFAULT 0,
      start_date DATE NULL,
      end_date DATE NULL,
      treasury_id CHAR(36) NULL,
      phase_number INT NULL,
      has_percentage BOOLEAN NOT NULL DEFAULT FALSE,
      percentage_value DECIMAL(10,2) NOT NULL DEFAULT 0,
      reference_number VARCHAR(50) NULL,
      notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      CONSTRAINT fk_phases_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      CONSTRAINT fk_phases_treasury FOREIGN KEY (treasury_id) REFERENCES treasuries(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS project_items (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      project_id CHAR(36) NOT NULL,
      phase_id CHAR(36) NULL,
      engineer_id CHAR(36) NULL,
      measurement_config_id CHAR(36) NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      measurement_type VARCHAR(50) NOT NULL DEFAULT 'linear',
      quantity DECIMAL(18,4) NOT NULL DEFAULT 0,
      unit_price DECIMAL(18,4) NOT NULL DEFAULT 0,
      total_price DECIMAL(18,4) NOT NULL DEFAULT 0,
      length DECIMAL(18,4) NULL,
      width DECIMAL(18,4) NULL,
      height DECIMAL(18,4) NULL,
      formula TEXT NULL,
      component_values JSON NULL,
      measurement_factor DECIMAL(18,4) NULL,
      progress DECIMAL(10,2) NULL DEFAULT 0,
      notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      CONSTRAINT fk_items_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      CONSTRAINT fk_items_phase FOREIGN KEY (phase_id) REFERENCES project_phases(id) ON DELETE SET NULL,
      CONSTRAINT fk_items_engineer FOREIGN KEY (engineer_id) REFERENCES engineers(id) ON DELETE SET NULL,
      CONSTRAINT fk_items_measurement FOREIGN KEY (measurement_config_id) REFERENCES measurement_configs(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS general_project_items (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      measurement_type VARCHAR(50) NOT NULL DEFAULT 'linear',
      default_unit_price DECIMAL(18,4) NOT NULL DEFAULT 0,
      category VARCHAR(255) NULL,
      formula TEXT NULL,
      measurement_config_id CHAR(36) NULL,
      notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      CONSTRAINT fk_gi_measurement FOREIGN KEY (measurement_config_id) REFERENCES measurement_configs(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS equipment_rentals (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      equipment_id CHAR(36) NOT NULL,
      project_id CHAR(36) NULL,
      start_date DATE NOT NULL DEFAULT (CURRENT_DATE),
      end_date DATE NULL,
      daily_rate DECIMAL(18,4) NOT NULL DEFAULT 0,
      total_amount DECIMAL(18,4) NOT NULL DEFAULT 0,
      status VARCHAR(50) NOT NULL DEFAULT 'active',
      damage_cost DECIMAL(18,4) NULL DEFAULT 0,
      damage_notes TEXT NULL,
      custody_id CHAR(36) NULL,
      fund_source VARCHAR(100) NULL,
      notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      CONSTRAINT fk_rentals_equipment FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
      CONSTRAINT fk_rentals_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS project_custody (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      project_id CHAR(36) NULL,
      engineer_id CHAR(36) NULL,
      employee_id CHAR(36) NULL,
      holder_type VARCHAR(50) NOT NULL DEFAULT 'engineer',
      amount DECIMAL(18,4) NOT NULL DEFAULT 0,
      spent_amount DECIMAL(18,4) NULL DEFAULT 0,
      remaining_amount DECIMAL(18,4) NULL DEFAULT 0,
      date DATE NOT NULL DEFAULT (CURRENT_DATE),
      status VARCHAR(50) NULL DEFAULT 'active',
      notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      CONSTRAINT fk_custody_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
      CONSTRAINT fk_custody_engineer FOREIGN KEY (engineer_id) REFERENCES engineers(id) ON DELETE SET NULL,
      CONSTRAINT fk_custody_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS contracts (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      title VARCHAR(500) NOT NULL,
      contract_number VARCHAR(100) NOT NULL,
      project_id CHAR(36) NULL,
      client_id CHAR(36) NULL,
      phase_id CHAR(36) NULL,
      amount DECIMAL(18,4) NOT NULL DEFAULT 0,
      start_date DATE NOT NULL,
      end_date DATE NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'draft',
      description TEXT NULL,
      payment_terms TEXT NULL,
      attachments JSON NULL,
      notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      CONSTRAINT fk_contracts_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
      CONSTRAINT fk_contracts_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
      CONSTRAINT fk_contracts_phase FOREIGN KEY (phase_id) REFERENCES project_phases(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS contract_clauses (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      contract_id CHAR(36) NOT NULL,
      title VARCHAR(500) NOT NULL,
      content TEXT NOT NULL,
      order_index INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      CONSTRAINT fk_clauses_contract FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS contract_items (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      contract_id CHAR(36) NOT NULL,
      project_item_id CHAR(36) NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      quantity DECIMAL(18,4) NOT NULL DEFAULT 0,
      unit_price DECIMAL(18,4) NOT NULL DEFAULT 0,
      total_price DECIMAL(18,4) NOT NULL DEFAULT 0,
      order_index INT NOT NULL DEFAULT 0,
      notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      CONSTRAINT fk_ci_contract FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
      CONSTRAINT fk_ci_item FOREIGN KEY (project_item_id) REFERENCES project_items(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS client_payments (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      project_id CHAR(36) NOT NULL,
      client_id CHAR(36) NULL,
      treasury_id CHAR(36) NOT NULL,
      amount DECIMAL(18,4) NOT NULL DEFAULT 0,
      used_amount DECIMAL(18,4) NOT NULL DEFAULT 0,
      credit_used DECIMAL(18,4) NOT NULL DEFAULT 0,
      date DATE NOT NULL DEFAULT (CURRENT_DATE),
      payment_type VARCHAR(50) NOT NULL DEFAULT 'allocated',
      payment_method VARCHAR(50) NULL DEFAULT 'cash',
      notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      CONSTRAINT fk_cp_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      CONSTRAINT fk_cp_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
      CONSTRAINT fk_cp_treasury FOREIGN KEY (treasury_id) REFERENCES treasuries(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS client_payment_allocations (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      payment_id CHAR(36) NOT NULL,
      reference_id CHAR(36) NOT NULL,
      reference_type VARCHAR(100) NOT NULL,
      phase_id CHAR(36) NULL,
      amount DECIMAL(18,4) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      CONSTRAINT fk_cpa_payment FOREIGN KEY (payment_id) REFERENCES client_payments(id) ON DELETE CASCADE,
      CONSTRAINT fk_cpa_phase FOREIGN KEY (phase_id) REFERENCES project_phases(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS purchases (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      project_id CHAR(36) NULL,
      phase_id CHAR(36) NULL,
      supplier_id CHAR(36) NULL,
      treasury_id CHAR(36) NULL,
      total_amount DECIMAL(18,4) NOT NULL DEFAULT 0,
      paid_amount DECIMAL(18,4) NOT NULL DEFAULT 0,
      remaining_amount DECIMAL(18,4) NOT NULL DEFAULT 0,
      commission DECIMAL(18,4) NULL DEFAULT 0,
      date DATE NOT NULL DEFAULT (CURRENT_DATE),
      due_date DATE NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'paid',
      invoice_number VARCHAR(100) NULL,
      payment_method VARCHAR(50) NULL DEFAULT 'cash',
      notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      CONSTRAINT fk_purchases_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
      CONSTRAINT fk_purchases_phase FOREIGN KEY (phase_id) REFERENCES project_phases(id) ON DELETE SET NULL,
      CONSTRAINT fk_purchases_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
      CONSTRAINT fk_purchases_treasury FOREIGN KEY (treasury_id) REFERENCES treasuries(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS expenses (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      project_id CHAR(36) NULL,
      phase_id CHAR(36) NULL,
      supplier_id CHAR(36) NULL,
      technician_id CHAR(36) NULL,
      type VARCHAR(100) NOT NULL DEFAULT 'materials',
      description TEXT NOT NULL DEFAULT '',
      subtype VARCHAR(100) NULL,
      amount DECIMAL(18,4) NOT NULL DEFAULT 0,
      date DATE NOT NULL DEFAULT (CURRENT_DATE),
      payment_method VARCHAR(50) NULL DEFAULT 'cash',
      invoice_number VARCHAR(100) NULL,
      notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      CONSTRAINT fk_expenses_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
      CONSTRAINT fk_expenses_phase FOREIGN KEY (phase_id) REFERENCES project_phases(id) ON DELETE SET NULL,
      CONSTRAINT fk_expenses_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
      CONSTRAINT fk_expenses_technician FOREIGN KEY (technician_id) REFERENCES technicians(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS income (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      project_id CHAR(36) NULL,
      client_id CHAR(36) NULL,
      reference_id CHAR(36) NULL,
      type VARCHAR(100) NOT NULL DEFAULT 'service',
      subtype VARCHAR(100) NULL,
      amount DECIMAL(18,4) NOT NULL DEFAULT 0,
      date DATE NOT NULL DEFAULT (CURRENT_DATE),
      payment_method VARCHAR(50) NULL DEFAULT 'cash',
      status VARCHAR(50) NULL DEFAULT 'received',
      notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      CONSTRAINT fk_income_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
      CONSTRAINT fk_income_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS transfers (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      project_id CHAR(36) NULL,
      party_name VARCHAR(255) NULL,
      type VARCHAR(50) NULL DEFAULT 'advance',
      subtype VARCHAR(100) NULL,
      amount DECIMAL(18,4) NOT NULL DEFAULT 0,
      spent_amount DECIMAL(18,4) NULL DEFAULT 0,
      remaining_amount DECIMAL(18,4) NULL DEFAULT 0,
      date DATE NOT NULL DEFAULT (CURRENT_DATE),
      status VARCHAR(50) NULL DEFAULT 'active',
      notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS project_suppliers (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      project_id CHAR(36) NOT NULL,
      supplier_id CHAR(36) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_ps (project_id, supplier_id),
      CONSTRAINT fk_ps_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      CONSTRAINT fk_ps_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS project_technicians (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      project_id CHAR(36) NOT NULL,
      technician_id CHAR(36) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_pt (project_id, technician_id),
      CONSTRAINT fk_pt_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      CONSTRAINT fk_pt_technician FOREIGN KEY (technician_id) REFERENCES technicians(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS project_item_technicians (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      project_item_id CHAR(36) NOT NULL,
      technician_id CHAR(36) NOT NULL,
      rate DECIMAL(18,4) NULL DEFAULT 0,
      rate_type VARCHAR(50) NULL,
      quantity DECIMAL(18,4) NULL DEFAULT 0,
      total_cost DECIMAL(18,4) NULL DEFAULT 0,
      notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      CONSTRAINT fk_pit_item FOREIGN KEY (project_item_id) REFERENCES project_items(id) ON DELETE CASCADE,
      CONSTRAINT fk_pit_tech FOREIGN KEY (technician_id) REFERENCES technicians(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS technician_progress_records (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      project_item_id CHAR(36) NOT NULL,
      technician_id CHAR(36) NOT NULL,
      quantity_completed DECIMAL(18,4) NOT NULL DEFAULT 0,
      date DATE NOT NULL DEFAULT (CURRENT_DATE),
      notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      CONSTRAINT fk_tpr_item FOREIGN KEY (project_item_id) REFERENCES project_items(id) ON DELETE CASCADE,
      CONSTRAINT fk_tpr_tech FOREIGN KEY (technician_id) REFERENCES technicians(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS inspection_checklists (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      project_id CHAR(36) NOT NULL,
      phase_id CHAR(36) NULL,
      title VARCHAR(500) NOT NULL,
      description TEXT NULL,
      checklist_type VARCHAR(50) NULL DEFAULT 'quality',
      inspector_name VARCHAR(255) NULL,
      inspection_date DATE NULL DEFAULT (CURRENT_DATE),
      status VARCHAR(50) NULL DEFAULT 'pending',
      overall_score DECIMAL(10,2) NULL,
      created_by CHAR(36) NULL,
      notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      CONSTRAINT fk_ic_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      CONSTRAINT fk_ic_phase FOREIGN KEY (phase_id) REFERENCES project_phases(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS checklist_items (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      checklist_id CHAR(36) NOT NULL,
      item_text TEXT NOT NULL,
      category VARCHAR(255) NULL,
      status VARCHAR(50) NULL DEFAULT 'pending',
      order_index INT NULL DEFAULT 0,
      notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      CONSTRAINT fk_cli_checklist FOREIGN KEY (checklist_id) REFERENCES inspection_checklists(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS project_schedules (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      project_id CHAR(36) NOT NULL,
      phase_id CHAR(36) NULL,
      task_name VARCHAR(500) NOT NULL,
      description TEXT NULL,
      status VARCHAR(50) NULL DEFAULT 'not_started',
      planned_start DATE NULL,
      planned_end DATE NULL,
      actual_start DATE NULL,
      actual_end DATE NULL,
      baseline_start DATE NULL,
      baseline_end DATE NULL,
      planned_duration INT NULL,
      actual_duration INT NULL,
      planned_cost DECIMAL(18,4) NULL DEFAULT 0,
      actual_cost DECIMAL(18,4) NULL DEFAULT 0,
      percent_complete DECIMAL(10,2) NULL DEFAULT 0,
      dependencies TEXT NULL,
      assigned_to VARCHAR(255) NULL,
      order_index INT NULL DEFAULT 0,
      notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      CONSTRAINT fk_sched_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      CONSTRAINT fk_sched_phase FOREIGN KEY (phase_id) REFERENCES project_phases(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS stock_movements (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      material_id CHAR(36) NOT NULL,
      project_id CHAR(36) NULL,
      phase_id CHAR(36) NULL,
      movement_type VARCHAR(50) NOT NULL DEFAULT 'in',
      quantity DECIMAL(18,4) NOT NULL,
      unit_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
      total_cost DECIMAL(18,4) NULL,
      reference_number VARCHAR(100) NULL,
      location VARCHAR(255) NULL,
      performed_by CHAR(36) NULL,
      notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      CONSTRAINT fk_sm_material FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS cash_flow_forecast (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      project_id CHAR(36) NULL,
      period_month INT NOT NULL,
      period_year INT NOT NULL,
      opening_balance DECIMAL(18,4) NOT NULL DEFAULT 0,
      expected_invoicing DECIMAL(18,4) NOT NULL DEFAULT 0,
      expected_collection DECIMAL(18,4) NOT NULL DEFAULT 0,
      actual_collected DECIMAL(18,4) NOT NULL DEFAULT 0,
      planned_purchases DECIMAL(18,4) NOT NULL DEFAULT 0,
      planned_labor DECIMAL(18,4) NOT NULL DEFAULT 0,
      planned_equipment DECIMAL(18,4) NOT NULL DEFAULT 0,
      planned_overhead DECIMAL(18,4) NOT NULL DEFAULT 0,
      actual_paid DECIMAL(18,4) NOT NULL DEFAULT 0,
      created_by CHAR(36) NULL,
      notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      CONSTRAINT fk_cff_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS risk_register (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      project_id CHAR(36) NULL,
      title VARCHAR(500) NOT NULL,
      description TEXT NULL,
      category VARCHAR(100) NULL DEFAULT 'technical',
      probability VARCHAR(50) NULL DEFAULT 'medium',
      impact VARCHAR(50) NULL DEFAULT 'medium',
      risk_score DECIMAL(10,2) NULL DEFAULT 0,
      status VARCHAR(50) NULL DEFAULT 'open',
      owner VARCHAR(255) NULL,
      mitigation_plan TEXT NULL,
      contingency_plan TEXT NULL,
      identified_date DATE NULL DEFAULT (CURRENT_DATE),
      review_date DATE NULL,
      notes TEXT NULL,
      created_by CHAR(36) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      CONSTRAINT fk_rr_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS variation_orders (
      id CHAR(36) NOT NULL DEFAULT (UUID()),
      project_id CHAR(36) NOT NULL,
      phase_id CHAR(36) NULL,
      vo_number VARCHAR(100) NOT NULL,
      title VARCHAR(500) NOT NULL,
      description TEXT NULL,
      type VARCHAR(50) NULL DEFAULT 'addition',
      status VARCHAR(50) NULL DEFAULT 'pending',
      original_amount DECIMAL(18,4) NULL DEFAULT 0,
      approved_amount DECIMAL(18,4) NULL DEFAULT 0,
      requested_by VARCHAR(255) NULL,
      approved_by VARCHAR(255) NULL,
      request_date DATE NULL DEFAULT (CURRENT_DATE),
      approval_date DATE NULL,
      notes TEXT NULL,
      created_by CHAR(36) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      CONSTRAINT fk_vo_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      CONSTRAINT fk_vo_phase FOREIGN KEY (phase_id) REFERENCES project_phases(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ];
}

// ==================== MySQL Triggers ====================
function getMySQLTriggers() {
  return [
    // ===== 1. Generate phase reference number (BEFORE INSERT) =====
    `CREATE TRIGGER trg_phase_reference BEFORE INSERT ON project_phases
     FOR EACH ROW
     BEGIN
       DECLARE current_yr INT;
       DECLARE yr_short VARCHAR(2);
       DECLARE next_num INT;
       DECLARE proj_phase_count INT;
       SET current_yr = YEAR(NOW());
       SET yr_short = RIGHT(CAST(current_yr AS CHAR), 2);
       INSERT INTO phase_reference_seq (year, last_number) VALUES (current_yr, 0)
         ON DUPLICATE KEY UPDATE year = year;
       UPDATE phase_reference_seq SET last_number = last_number + 1 WHERE year = current_yr;
       SELECT last_number INTO next_num FROM phase_reference_seq WHERE year = current_yr;
       SET NEW.reference_number = CONCAT(next_num, '/', yr_short);
       SELECT COALESCE(MAX(phase_number), 0) + 1 INTO proj_phase_count
         FROM project_phases WHERE project_id = NEW.project_id;
       SET NEW.phase_number = proj_phase_count;
     END`,

    // ===== 2. Purchases AFTER INSERT (spent + treasury sync + audit) =====
    `CREATE TRIGGER trg_purchases_ai AFTER INSERT ON purchases
     FOR EACH ROW
     BEGIN
       DECLARE expected_amt DECIMAL(18,4);
       IF NEW.project_id IS NOT NULL THEN
         UPDATE projects SET spent = (
           COALESCE((SELECT SUM(total_amount) FROM purchases WHERE project_id = NEW.project_id), 0) +
           COALESCE((SELECT SUM(amount) FROM expenses WHERE project_id = NEW.project_id), 0) +
           COALESCE((SELECT SUM(total_amount) FROM equipment_rentals WHERE project_id = NEW.project_id), 0) +
           COALESCE((SELECT SUM(amount) FROM project_custody WHERE project_id = NEW.project_id), 0)
         ) WHERE id = NEW.project_id;
       END IF;
       IF NEW.treasury_id IS NOT NULL THEN
         SET expected_amt = COALESCE(NEW.paid_amount, 0) + COALESCE(NEW.commission, 0);
         IF expected_amt > 0 THEN
           INSERT INTO treasury_transactions (id, treasury_id, type, amount, balance_after, description, reference_id, reference_type, date, source)
           VALUES (UUID(), NEW.treasury_id, 'withdrawal', expected_amt, 0,
             CONCAT('فاتورة مشتريات رقم ', COALESCE(NEW.invoice_number, NEW.id)),
             NEW.id, 'purchase', NEW.date, 'purchases');
         END IF;
       END IF;
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, new_data)
       VALUES ('purchases', NEW.id, 'INSERT', @current_user_id, @current_user_email,
         JSON_OBJECT('total_amount', NEW.total_amount, 'paid_amount', NEW.paid_amount, 'invoice_number', NEW.invoice_number, 'treasury_id', NEW.treasury_id));
     END`,

    // ===== 3. Purchases AFTER UPDATE (spent + treasury sync + audit) =====
    `CREATE TRIGGER trg_purchases_au AFTER UPDATE ON purchases
     FOR EACH ROW
     BEGIN
       DECLARE expected_amt DECIMAL(18,4);
       DECLARE existing_tx_id CHAR(36);
       DECLARE existing_treasury CHAR(36);
       IF NEW.project_id IS NOT NULL THEN
         UPDATE projects SET spent = (
           COALESCE((SELECT SUM(total_amount) FROM purchases WHERE project_id = NEW.project_id), 0) +
           COALESCE((SELECT SUM(amount) FROM expenses WHERE project_id = NEW.project_id), 0) +
           COALESCE((SELECT SUM(total_amount) FROM equipment_rentals WHERE project_id = NEW.project_id), 0) +
           COALESCE((SELECT SUM(amount) FROM project_custody WHERE project_id = NEW.project_id), 0)
         ) WHERE id = NEW.project_id;
       END IF;
       IF OLD.project_id IS NOT NULL AND (NEW.project_id IS NULL OR OLD.project_id != NEW.project_id) THEN
         UPDATE projects SET spent = (
           COALESCE((SELECT SUM(total_amount) FROM purchases WHERE project_id = OLD.project_id), 0) +
           COALESCE((SELECT SUM(amount) FROM expenses WHERE project_id = OLD.project_id), 0) +
           COALESCE((SELECT SUM(total_amount) FROM equipment_rentals WHERE project_id = OLD.project_id), 0) +
           COALESCE((SELECT SUM(amount) FROM project_custody WHERE project_id = OLD.project_id), 0)
         ) WHERE id = OLD.project_id;
       END IF;
       IF NEW.treasury_id IS NOT NULL THEN
         SET expected_amt = COALESCE(NEW.paid_amount, 0) + COALESCE(NEW.commission, 0);
         SELECT id, treasury_id INTO existing_tx_id, existing_treasury
           FROM treasury_transactions WHERE reference_id = NEW.id AND reference_type = 'purchase' LIMIT 1;
         IF existing_tx_id IS NOT NULL THEN
           IF existing_treasury != NEW.treasury_id THEN
             UPDATE treasury_transactions SET amount = expected_amt, treasury_id = NEW.treasury_id,
               description = CONCAT('فاتورة مشتريات رقم ', COALESCE(NEW.invoice_number, NEW.id))
             WHERE id = existing_tx_id;
             UPDATE treasuries SET balance = (
               SELECT COALESCE(SUM(CASE WHEN type='deposit' THEN amount ELSE -amount END), 0)
               FROM treasury_transactions WHERE treasury_id = existing_treasury
             ) WHERE id = existing_treasury;
           ELSE
             UPDATE treasury_transactions SET amount = expected_amt,
               description = CONCAT('فاتورة مشتريات رقم ', COALESCE(NEW.invoice_number, NEW.id))
             WHERE id = existing_tx_id;
           END IF;
           UPDATE treasuries SET balance = (
             SELECT COALESCE(SUM(CASE WHEN type='deposit' THEN amount ELSE -amount END), 0)
             FROM treasury_transactions WHERE treasury_id = NEW.treasury_id
           ) WHERE id = NEW.treasury_id;
         ELSE
           IF expected_amt > 0 THEN
             INSERT INTO treasury_transactions (id, treasury_id, type, amount, balance_after, description, reference_id, reference_type, date, source)
             VALUES (UUID(), NEW.treasury_id, 'withdrawal', expected_amt, 0,
               CONCAT('فاتورة مشتريات رقم ', COALESCE(NEW.invoice_number, NEW.id)),
               NEW.id, 'purchase', NEW.date, 'purchases');
           END IF;
         END IF;
       END IF;
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, old_data, new_data)
       VALUES ('purchases', NEW.id, 'UPDATE', @current_user_id, @current_user_email,
         JSON_OBJECT('total_amount', OLD.total_amount, 'paid_amount', OLD.paid_amount),
         JSON_OBJECT('total_amount', NEW.total_amount, 'paid_amount', NEW.paid_amount));
     END`,

    // ===== 4. Purchases BEFORE DELETE (cleanup) =====
    `CREATE TRIGGER trg_purchases_bd BEFORE DELETE ON purchases
     FOR EACH ROW
     BEGIN
       DELETE FROM treasury_transactions WHERE reference_id = OLD.id AND reference_type = 'purchase';
       DELETE FROM client_payment_allocations WHERE reference_id = OLD.id AND reference_type = 'purchase';
     END`,

    // ===== 5. Purchases AFTER DELETE (spent + audit) =====
    `CREATE TRIGGER trg_purchases_ad AFTER DELETE ON purchases
     FOR EACH ROW
     BEGIN
       IF OLD.project_id IS NOT NULL THEN
         UPDATE projects SET spent = (
           COALESCE((SELECT SUM(total_amount) FROM purchases WHERE project_id = OLD.project_id), 0) +
           COALESCE((SELECT SUM(amount) FROM expenses WHERE project_id = OLD.project_id), 0) +
           COALESCE((SELECT SUM(total_amount) FROM equipment_rentals WHERE project_id = OLD.project_id), 0) +
           COALESCE((SELECT SUM(amount) FROM project_custody WHERE project_id = OLD.project_id), 0)
         ) WHERE id = OLD.project_id;
       END IF;
       IF OLD.treasury_id IS NOT NULL THEN
         UPDATE treasuries SET balance = (
           SELECT COALESCE(SUM(CASE WHEN type='deposit' THEN amount ELSE -amount END), 0)
           FROM treasury_transactions WHERE treasury_id = OLD.treasury_id
         ) WHERE id = OLD.treasury_id;
       END IF;
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, old_data)
       VALUES ('purchases', OLD.id, 'DELETE', @current_user_id, @current_user_email,
         JSON_OBJECT('total_amount', OLD.total_amount, 'paid_amount', OLD.paid_amount, 'invoice_number', OLD.invoice_number));
     END`,

    // ===== 6. Expenses triggers (spent + audit) =====
    `CREATE TRIGGER trg_expenses_ai AFTER INSERT ON expenses
     FOR EACH ROW
     BEGIN
       IF NEW.project_id IS NOT NULL THEN
         UPDATE projects SET spent = (
           COALESCE((SELECT SUM(total_amount) FROM purchases WHERE project_id = NEW.project_id), 0) +
           COALESCE((SELECT SUM(amount) FROM expenses WHERE project_id = NEW.project_id), 0) +
           COALESCE((SELECT SUM(total_amount) FROM equipment_rentals WHERE project_id = NEW.project_id), 0) +
           COALESCE((SELECT SUM(amount) FROM project_custody WHERE project_id = NEW.project_id), 0)
         ) WHERE id = NEW.project_id;
       END IF;
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, new_data)
       VALUES ('expenses', NEW.id, 'INSERT', @current_user_id, @current_user_email,
         JSON_OBJECT('type', NEW.type, 'amount', NEW.amount, 'description', NEW.description));
     END`,

    `CREATE TRIGGER trg_expenses_au AFTER UPDATE ON expenses
     FOR EACH ROW
     BEGIN
       IF NEW.project_id IS NOT NULL THEN
         UPDATE projects SET spent = (
           COALESCE((SELECT SUM(total_amount) FROM purchases WHERE project_id = NEW.project_id), 0) +
           COALESCE((SELECT SUM(amount) FROM expenses WHERE project_id = NEW.project_id), 0) +
           COALESCE((SELECT SUM(total_amount) FROM equipment_rentals WHERE project_id = NEW.project_id), 0) +
           COALESCE((SELECT SUM(amount) FROM project_custody WHERE project_id = NEW.project_id), 0)
         ) WHERE id = NEW.project_id;
       END IF;
       IF OLD.project_id IS NOT NULL AND (NEW.project_id IS NULL OR OLD.project_id != NEW.project_id) THEN
         UPDATE projects SET spent = (
           COALESCE((SELECT SUM(total_amount) FROM purchases WHERE project_id = OLD.project_id), 0) +
           COALESCE((SELECT SUM(amount) FROM expenses WHERE project_id = OLD.project_id), 0) +
           COALESCE((SELECT SUM(total_amount) FROM equipment_rentals WHERE project_id = OLD.project_id), 0) +
           COALESCE((SELECT SUM(amount) FROM project_custody WHERE project_id = OLD.project_id), 0)
         ) WHERE id = OLD.project_id;
       END IF;
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, old_data, new_data)
       VALUES ('expenses', NEW.id, 'UPDATE', @current_user_id, @current_user_email,
         JSON_OBJECT('amount', OLD.amount, 'type', OLD.type),
         JSON_OBJECT('amount', NEW.amount, 'type', NEW.type));
     END`,

    `CREATE TRIGGER trg_expenses_ad AFTER DELETE ON expenses
     FOR EACH ROW
     BEGIN
       IF OLD.project_id IS NOT NULL THEN
         UPDATE projects SET spent = (
           COALESCE((SELECT SUM(total_amount) FROM purchases WHERE project_id = OLD.project_id), 0) +
           COALESCE((SELECT SUM(amount) FROM expenses WHERE project_id = OLD.project_id), 0) +
           COALESCE((SELECT SUM(total_amount) FROM equipment_rentals WHERE project_id = OLD.project_id), 0) +
           COALESCE((SELECT SUM(amount) FROM project_custody WHERE project_id = OLD.project_id), 0)
         ) WHERE id = OLD.project_id;
       END IF;
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, old_data)
       VALUES ('expenses', OLD.id, 'DELETE', @current_user_id, @current_user_email,
         JSON_OBJECT('amount', OLD.amount, 'type', OLD.type, 'description', OLD.description));
     END`,

    // ===== 7. Equipment rentals triggers (spent + audit) =====
    `CREATE TRIGGER trg_rentals_ai AFTER INSERT ON equipment_rentals
     FOR EACH ROW
     BEGIN
       IF NEW.project_id IS NOT NULL THEN
         UPDATE projects SET spent = (
           COALESCE((SELECT SUM(total_amount) FROM purchases WHERE project_id = NEW.project_id), 0) +
           COALESCE((SELECT SUM(amount) FROM expenses WHERE project_id = NEW.project_id), 0) +
           COALESCE((SELECT SUM(total_amount) FROM equipment_rentals WHERE project_id = NEW.project_id), 0) +
           COALESCE((SELECT SUM(amount) FROM project_custody WHERE project_id = NEW.project_id), 0)
         ) WHERE id = NEW.project_id;
       END IF;
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, new_data)
       VALUES ('equipment_rentals', NEW.id, 'INSERT', @current_user_id, @current_user_email,
         JSON_OBJECT('equipment_id', NEW.equipment_id, 'daily_rate', NEW.daily_rate, 'total_amount', NEW.total_amount));
     END`,

    `CREATE TRIGGER trg_rentals_au AFTER UPDATE ON equipment_rentals
     FOR EACH ROW
     BEGIN
       IF NEW.project_id IS NOT NULL THEN
         UPDATE projects SET spent = (
           COALESCE((SELECT SUM(total_amount) FROM purchases WHERE project_id = NEW.project_id), 0) +
           COALESCE((SELECT SUM(amount) FROM expenses WHERE project_id = NEW.project_id), 0) +
           COALESCE((SELECT SUM(total_amount) FROM equipment_rentals WHERE project_id = NEW.project_id), 0) +
           COALESCE((SELECT SUM(amount) FROM project_custody WHERE project_id = NEW.project_id), 0)
         ) WHERE id = NEW.project_id;
       END IF;
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, old_data, new_data)
       VALUES ('equipment_rentals', NEW.id, 'UPDATE', @current_user_id, @current_user_email,
         JSON_OBJECT('total_amount', OLD.total_amount, 'status', OLD.status),
         JSON_OBJECT('total_amount', NEW.total_amount, 'status', NEW.status));
     END`,

    `CREATE TRIGGER trg_rentals_ad AFTER DELETE ON equipment_rentals
     FOR EACH ROW
     BEGIN
       IF OLD.project_id IS NOT NULL THEN
         UPDATE projects SET spent = (
           COALESCE((SELECT SUM(total_amount) FROM purchases WHERE project_id = OLD.project_id), 0) +
           COALESCE((SELECT SUM(amount) FROM expenses WHERE project_id = OLD.project_id), 0) +
           COALESCE((SELECT SUM(total_amount) FROM equipment_rentals WHERE project_id = OLD.project_id), 0) +
           COALESCE((SELECT SUM(amount) FROM project_custody WHERE project_id = OLD.project_id), 0)
         ) WHERE id = OLD.project_id;
       END IF;
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, old_data)
       VALUES ('equipment_rentals', OLD.id, 'DELETE', @current_user_id, @current_user_email,
         JSON_OBJECT('equipment_id', OLD.equipment_id, 'total_amount', OLD.total_amount));
     END`,

    // ===== 8. Project custody triggers (spent + audit) =====
    `CREATE TRIGGER trg_custody_ai AFTER INSERT ON project_custody
     FOR EACH ROW
     BEGIN
       IF NEW.project_id IS NOT NULL THEN
         UPDATE projects SET spent = (
           COALESCE((SELECT SUM(total_amount) FROM purchases WHERE project_id = NEW.project_id), 0) +
           COALESCE((SELECT SUM(amount) FROM expenses WHERE project_id = NEW.project_id), 0) +
           COALESCE((SELECT SUM(total_amount) FROM equipment_rentals WHERE project_id = NEW.project_id), 0) +
           COALESCE((SELECT SUM(amount) FROM project_custody WHERE project_id = NEW.project_id), 0)
         ) WHERE id = NEW.project_id;
       END IF;
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, new_data)
       VALUES ('project_custody', NEW.id, 'INSERT', @current_user_id, @current_user_email,
         JSON_OBJECT('amount', NEW.amount, 'holder_type', NEW.holder_type, 'status', NEW.status));
     END`,

    `CREATE TRIGGER trg_custody_au AFTER UPDATE ON project_custody
     FOR EACH ROW
     BEGIN
       IF NEW.project_id IS NOT NULL THEN
         UPDATE projects SET spent = (
           COALESCE((SELECT SUM(total_amount) FROM purchases WHERE project_id = NEW.project_id), 0) +
           COALESCE((SELECT SUM(amount) FROM expenses WHERE project_id = NEW.project_id), 0) +
           COALESCE((SELECT SUM(total_amount) FROM equipment_rentals WHERE project_id = NEW.project_id), 0) +
           COALESCE((SELECT SUM(amount) FROM project_custody WHERE project_id = NEW.project_id), 0)
         ) WHERE id = NEW.project_id;
       END IF;
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, old_data, new_data)
       VALUES ('project_custody', NEW.id, 'UPDATE', @current_user_id, @current_user_email,
         JSON_OBJECT('amount', OLD.amount, 'spent_amount', OLD.spent_amount, 'status', OLD.status),
         JSON_OBJECT('amount', NEW.amount, 'spent_amount', NEW.spent_amount, 'status', NEW.status));
     END`,

    `CREATE TRIGGER trg_custody_ad AFTER DELETE ON project_custody
     FOR EACH ROW
     BEGIN
       IF OLD.project_id IS NOT NULL THEN
         UPDATE projects SET spent = (
           COALESCE((SELECT SUM(total_amount) FROM purchases WHERE project_id = OLD.project_id), 0) +
           COALESCE((SELECT SUM(amount) FROM expenses WHERE project_id = OLD.project_id), 0) +
           COALESCE((SELECT SUM(total_amount) FROM equipment_rentals WHERE project_id = OLD.project_id), 0) +
           COALESCE((SELECT SUM(amount) FROM project_custody WHERE project_id = OLD.project_id), 0)
         ) WHERE id = OLD.project_id;
       END IF;
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, old_data)
       VALUES ('project_custody', OLD.id, 'DELETE', @current_user_id, @current_user_email,
         JSON_OBJECT('amount', OLD.amount, 'holder_type', OLD.holder_type));
     END`,

    // ===== 9. Auto sync treasury balance after transaction changes =====
    `CREATE TRIGGER trg_tt_ai_balance AFTER INSERT ON treasury_transactions
     FOR EACH ROW
     BEGIN
       UPDATE treasuries SET balance = (
         SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0)
         FROM treasury_transactions WHERE treasury_id = NEW.treasury_id
       ) WHERE id = NEW.treasury_id;
       UPDATE treasury_transactions SET balance_after = (
         SELECT balance FROM treasuries WHERE id = NEW.treasury_id
       ) WHERE id = NEW.id;
     END`,

    `CREATE TRIGGER trg_tt_au_balance AFTER UPDATE ON treasury_transactions
     FOR EACH ROW
     BEGIN
       UPDATE treasuries SET balance = (
         SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0)
         FROM treasury_transactions WHERE treasury_id = NEW.treasury_id
       ) WHERE id = NEW.treasury_id;
       IF OLD.treasury_id != NEW.treasury_id THEN
         UPDATE treasuries SET balance = (
           SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0)
           FROM treasury_transactions WHERE treasury_id = OLD.treasury_id
         ) WHERE id = OLD.treasury_id;
       END IF;
     END`,

    `CREATE TRIGGER trg_tt_ad_balance AFTER DELETE ON treasury_transactions
     FOR EACH ROW
     BEGIN
       UPDATE treasuries SET balance = (
         SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0)
         FROM treasury_transactions WHERE treasury_id = OLD.treasury_id
       ) WHERE id = OLD.treasury_id;
     END`,

    // ===== 10. Client payment deletion cleanup =====
    `CREATE TRIGGER trg_client_payment_bd BEFORE DELETE ON client_payments
     FOR EACH ROW
     BEGIN
       DELETE FROM treasury_transactions WHERE reference_id = OLD.id AND reference_type = 'client_payment';
       DELETE FROM client_payment_allocations WHERE payment_id = OLD.id;
     END`,

    `CREATE TRIGGER trg_client_payment_ad AFTER DELETE ON client_payments
     FOR EACH ROW
     BEGIN
       IF OLD.treasury_id IS NOT NULL THEN
         UPDATE treasuries SET balance = (
           SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0)
           FROM treasury_transactions WHERE treasury_id = OLD.treasury_id
         ) WHERE id = OLD.treasury_id;
       END IF;
     END`,

    // ===== 11. Material stock update from stock_movements =====
    `CREATE TRIGGER trg_stock_ai AFTER INSERT ON stock_movements
     FOR EACH ROW
     BEGIN
       UPDATE materials SET
         current_stock = current_stock + CASE
           WHEN NEW.movement_type IN ('in', 'return') THEN NEW.quantity
           WHEN NEW.movement_type = 'out' THEN -NEW.quantity
           WHEN NEW.movement_type = 'adjustment' THEN NEW.quantity
           ELSE 0
         END,
         unit_cost = CASE WHEN NEW.movement_type = 'in' AND NEW.unit_cost > 0 THEN NEW.unit_cost ELSE unit_cost END
       WHERE id = NEW.material_id;
     END`,

    `CREATE TRIGGER trg_stock_ad AFTER DELETE ON stock_movements
     FOR EACH ROW
     BEGIN
       UPDATE materials SET
         current_stock = current_stock - CASE
           WHEN OLD.movement_type IN ('in', 'return') THEN OLD.quantity
           WHEN OLD.movement_type = 'out' THEN -OLD.quantity
           WHEN OLD.movement_type = 'adjustment' THEN OLD.quantity
           ELSE 0
         END
       WHERE id = OLD.material_id;
     END`,

    // ===== 12. Audit log triggers for all main tables =====
    // Using @current_user_id and @current_user_email session variables

    // -- clients --
    `CREATE TRIGGER trg_audit_clients_ai AFTER INSERT ON clients
     FOR EACH ROW
     BEGIN
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, new_data)
       VALUES ('clients', NEW.id, 'INSERT', @current_user_id, @current_user_email, JSON_OBJECT('name', NEW.name, 'phone', NEW.phone, 'email', NEW.email));
     END`,
    `CREATE TRIGGER trg_audit_clients_au AFTER UPDATE ON clients
     FOR EACH ROW
     BEGIN
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, old_data, new_data)
       VALUES ('clients', NEW.id, 'UPDATE', @current_user_id, @current_user_email,
         JSON_OBJECT('name', OLD.name, 'phone', OLD.phone, 'email', OLD.email),
         JSON_OBJECT('name', NEW.name, 'phone', NEW.phone, 'email', NEW.email));
     END`,
    `CREATE TRIGGER trg_audit_clients_ad AFTER DELETE ON clients
     FOR EACH ROW
     BEGIN
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, old_data)
       VALUES ('clients', OLD.id, 'DELETE', @current_user_id, @current_user_email,
         JSON_OBJECT('name', OLD.name, 'phone', OLD.phone, 'email', OLD.email));
     END`,

    // -- projects --
    `CREATE TRIGGER trg_audit_projects_ai AFTER INSERT ON projects
     FOR EACH ROW
     BEGIN
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, new_data)
       VALUES ('projects', NEW.id, 'INSERT', @current_user_id, @current_user_email, JSON_OBJECT('name', NEW.name, 'budget', NEW.budget, 'status', NEW.status));
     END`,
    `CREATE TRIGGER trg_audit_projects_au AFTER UPDATE ON projects
     FOR EACH ROW
     BEGIN
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, old_data, new_data)
       VALUES ('projects', NEW.id, 'UPDATE', @current_user_id, @current_user_email,
         JSON_OBJECT('name', OLD.name, 'budget', OLD.budget, 'status', OLD.status, 'spent', OLD.spent),
         JSON_OBJECT('name', NEW.name, 'budget', NEW.budget, 'status', NEW.status, 'spent', NEW.spent));
     END`,
    `CREATE TRIGGER trg_audit_projects_ad AFTER DELETE ON projects
     FOR EACH ROW
     BEGIN
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, old_data)
       VALUES ('projects', OLD.id, 'DELETE', @current_user_id, @current_user_email, JSON_OBJECT('name', OLD.name, 'budget', OLD.budget, 'status', OLD.status));
     END`,

    // -- treasuries --
    `CREATE TRIGGER trg_audit_treasuries_ai AFTER INSERT ON treasuries
     FOR EACH ROW
     BEGIN
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, new_data)
       VALUES ('treasuries', NEW.id, 'INSERT', @current_user_id, @current_user_email, JSON_OBJECT('name', NEW.name, 'balance', NEW.balance, 'treasury_type', NEW.treasury_type));
     END`,
    `CREATE TRIGGER trg_audit_treasuries_au AFTER UPDATE ON treasuries
     FOR EACH ROW
     BEGIN
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, old_data, new_data)
       VALUES ('treasuries', NEW.id, 'UPDATE', @current_user_id, @current_user_email,
         JSON_OBJECT('name', OLD.name, 'balance', OLD.balance),
         JSON_OBJECT('name', NEW.name, 'balance', NEW.balance));
     END`,
    `CREATE TRIGGER trg_audit_treasuries_ad AFTER DELETE ON treasuries
     FOR EACH ROW
     BEGIN
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, old_data)
       VALUES ('treasuries', OLD.id, 'DELETE', @current_user_id, @current_user_email, JSON_OBJECT('name', OLD.name, 'balance', OLD.balance));
     END`,

    // -- income --
    `CREATE TRIGGER trg_audit_income_ai AFTER INSERT ON income
     FOR EACH ROW
     BEGIN
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, new_data)
       VALUES ('income', NEW.id, 'INSERT', @current_user_id, @current_user_email, JSON_OBJECT('type', NEW.type, 'amount', NEW.amount));
     END`,
    `CREATE TRIGGER trg_audit_income_au AFTER UPDATE ON income
     FOR EACH ROW
     BEGIN
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, old_data, new_data)
       VALUES ('income', NEW.id, 'UPDATE', @current_user_id, @current_user_email,
         JSON_OBJECT('amount', OLD.amount, 'type', OLD.type),
         JSON_OBJECT('amount', NEW.amount, 'type', NEW.type));
     END`,
    `CREATE TRIGGER trg_audit_income_ad AFTER DELETE ON income
     FOR EACH ROW
     BEGIN
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, old_data)
       VALUES ('income', OLD.id, 'DELETE', @current_user_id, @current_user_email, JSON_OBJECT('amount', OLD.amount, 'type', OLD.type));
     END`,

    // -- transfers --
    `CREATE TRIGGER trg_audit_transfers_ai AFTER INSERT ON transfers
     FOR EACH ROW
     BEGIN
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, new_data)
       VALUES ('transfers', NEW.id, 'INSERT', @current_user_id, @current_user_email, JSON_OBJECT('party_name', NEW.party_name, 'amount', NEW.amount, 'type', NEW.type));
     END`,
    `CREATE TRIGGER trg_audit_transfers_au AFTER UPDATE ON transfers
     FOR EACH ROW
     BEGIN
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, old_data, new_data)
       VALUES ('transfers', NEW.id, 'UPDATE', @current_user_id, @current_user_email,
         JSON_OBJECT('amount', OLD.amount, 'status', OLD.status),
         JSON_OBJECT('amount', NEW.amount, 'status', NEW.status));
     END`,
    `CREATE TRIGGER trg_audit_transfers_ad AFTER DELETE ON transfers
     FOR EACH ROW
     BEGIN
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, old_data)
       VALUES ('transfers', OLD.id, 'DELETE', @current_user_id, @current_user_email, JSON_OBJECT('party_name', OLD.party_name, 'amount', OLD.amount));
     END`,

    // -- engineers --
    `CREATE TRIGGER trg_audit_engineers_ai AFTER INSERT ON engineers
     FOR EACH ROW
     BEGIN
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, new_data)
       VALUES ('engineers', NEW.id, 'INSERT', @current_user_id, @current_user_email, JSON_OBJECT('name', NEW.name, 'specialty', NEW.specialty, 'engineer_type', NEW.engineer_type));
     END`,
    `CREATE TRIGGER trg_audit_engineers_au AFTER UPDATE ON engineers
     FOR EACH ROW
     BEGIN
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, old_data, new_data)
       VALUES ('engineers', NEW.id, 'UPDATE', @current_user_id, @current_user_email,
         JSON_OBJECT('name', OLD.name, 'specialty', OLD.specialty),
         JSON_OBJECT('name', NEW.name, 'specialty', NEW.specialty));
     END`,
    `CREATE TRIGGER trg_audit_engineers_ad AFTER DELETE ON engineers
     FOR EACH ROW
     BEGIN
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, old_data)
       VALUES ('engineers', OLD.id, 'DELETE', @current_user_id, @current_user_email, JSON_OBJECT('name', OLD.name, 'specialty', OLD.specialty));
     END`,

    // -- technicians --
    `CREATE TRIGGER trg_audit_technicians_ai AFTER INSERT ON technicians
     FOR EACH ROW
     BEGIN
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, new_data)
       VALUES ('technicians', NEW.id, 'INSERT', @current_user_id, @current_user_email, JSON_OBJECT('name', NEW.name, 'specialty', NEW.specialty));
     END`,
    `CREATE TRIGGER trg_audit_technicians_au AFTER UPDATE ON technicians
     FOR EACH ROW
     BEGIN
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, old_data, new_data)
       VALUES ('technicians', NEW.id, 'UPDATE', @current_user_id, @current_user_email,
         JSON_OBJECT('name', OLD.name, 'specialty', OLD.specialty),
         JSON_OBJECT('name', NEW.name, 'specialty', NEW.specialty));
     END`,
    `CREATE TRIGGER trg_audit_technicians_ad AFTER DELETE ON technicians
     FOR EACH ROW
     BEGIN
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, old_data)
       VALUES ('technicians', OLD.id, 'DELETE', @current_user_id, @current_user_email, JSON_OBJECT('name', OLD.name, 'specialty', OLD.specialty));
     END`,

    // -- suppliers --
    `CREATE TRIGGER trg_audit_suppliers_ai AFTER INSERT ON suppliers
     FOR EACH ROW
     BEGIN
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, new_data)
       VALUES ('suppliers', NEW.id, 'INSERT', @current_user_id, @current_user_email, JSON_OBJECT('name', NEW.name, 'category', NEW.category));
     END`,
    `CREATE TRIGGER trg_audit_suppliers_au AFTER UPDATE ON suppliers
     FOR EACH ROW
     BEGIN
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, old_data, new_data)
       VALUES ('suppliers', NEW.id, 'UPDATE', @current_user_id, @current_user_email,
         JSON_OBJECT('name', OLD.name, 'category', OLD.category),
         JSON_OBJECT('name', NEW.name, 'category', NEW.category));
     END`,
    `CREATE TRIGGER trg_audit_suppliers_ad AFTER DELETE ON suppliers
     FOR EACH ROW
     BEGIN
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, old_data)
       VALUES ('suppliers', OLD.id, 'DELETE', @current_user_id, @current_user_email, JSON_OBJECT('name', OLD.name, 'category', OLD.category));
     END`,

    // -- employees --
    `CREATE TRIGGER trg_audit_employees_ai AFTER INSERT ON employees
     FOR EACH ROW
     BEGIN
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, new_data)
       VALUES ('employees', NEW.id, 'INSERT', @current_user_id, @current_user_email, JSON_OBJECT('name', NEW.name, 'position', NEW.position));
     END`,
    `CREATE TRIGGER trg_audit_employees_au AFTER UPDATE ON employees
     FOR EACH ROW
     BEGIN
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, old_data, new_data)
       VALUES ('employees', NEW.id, 'UPDATE', @current_user_id, @current_user_email,
         JSON_OBJECT('name', OLD.name, 'position', OLD.position, 'salary', OLD.salary),
         JSON_OBJECT('name', NEW.name, 'position', NEW.position, 'salary', NEW.salary));
     END`,
    `CREATE TRIGGER trg_audit_employees_ad AFTER DELETE ON employees
     FOR EACH ROW
     BEGIN
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, old_data)
       VALUES ('employees', OLD.id, 'DELETE', @current_user_id, @current_user_email, JSON_OBJECT('name', OLD.name, 'position', OLD.position));
     END`,

    // -- project_phases --
    `CREATE TRIGGER trg_audit_phases_ai AFTER INSERT ON project_phases
     FOR EACH ROW
     BEGIN
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, new_data)
       VALUES ('project_phases', NEW.id, 'INSERT', @current_user_id, @current_user_email, JSON_OBJECT('name', NEW.name, 'status', NEW.status, 'reference_number', NEW.reference_number));
     END`,
    `CREATE TRIGGER trg_audit_phases_au AFTER UPDATE ON project_phases
     FOR EACH ROW
     BEGIN
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, old_data, new_data)
       VALUES ('project_phases', NEW.id, 'UPDATE', @current_user_id, @current_user_email,
         JSON_OBJECT('name', OLD.name, 'status', OLD.status),
         JSON_OBJECT('name', NEW.name, 'status', NEW.status));
     END`,
    `CREATE TRIGGER trg_audit_phases_ad AFTER DELETE ON project_phases
     FOR EACH ROW
     BEGIN
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, old_data)
       VALUES ('project_phases', OLD.id, 'DELETE', @current_user_id, @current_user_email, JSON_OBJECT('name', OLD.name, 'status', OLD.status));
     END`,

    // -- project_items --
    `CREATE TRIGGER trg_audit_items_ai AFTER INSERT ON project_items
     FOR EACH ROW
     BEGIN
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, new_data)
       VALUES ('project_items', NEW.id, 'INSERT', @current_user_id, @current_user_email, JSON_OBJECT('name', NEW.name, 'quantity', NEW.quantity, 'unit_price', NEW.unit_price, 'total_price', NEW.total_price));
     END`,
    `CREATE TRIGGER trg_audit_items_au AFTER UPDATE ON project_items
     FOR EACH ROW
     BEGIN
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, old_data, new_data)
       VALUES ('project_items', NEW.id, 'UPDATE', @current_user_id, @current_user_email,
         JSON_OBJECT('name', OLD.name, 'quantity', OLD.quantity, 'unit_price', OLD.unit_price, 'progress', OLD.progress),
         JSON_OBJECT('name', NEW.name, 'quantity', NEW.quantity, 'unit_price', NEW.unit_price, 'progress', NEW.progress));
     END`,
    `CREATE TRIGGER trg_audit_items_ad AFTER DELETE ON project_items
     FOR EACH ROW
     BEGIN
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, old_data)
       VALUES ('project_items', OLD.id, 'DELETE', @current_user_id, @current_user_email, JSON_OBJECT('name', OLD.name, 'quantity', OLD.quantity, 'total_price', OLD.total_price));
     END`,

    // -- client_payments --
    `CREATE TRIGGER trg_audit_cp_ai AFTER INSERT ON client_payments
     FOR EACH ROW
     BEGIN
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, new_data)
       VALUES ('client_payments', NEW.id, 'INSERT', @current_user_id, @current_user_email, JSON_OBJECT('amount', NEW.amount, 'payment_type', NEW.payment_type, 'payment_method', NEW.payment_method));
     END`,
    `CREATE TRIGGER trg_audit_cp_au AFTER UPDATE ON client_payments
     FOR EACH ROW
     BEGIN
       INSERT INTO audit_logs (table_name, record_id, action, user_id, user_email, old_data, new_data)
       VALUES ('client_payments', NEW.id, 'UPDATE', @current_user_id, @current_user_email,
         JSON_OBJECT('amount', OLD.amount, 'used_amount', OLD.used_amount),
         JSON_OBJECT('amount', NEW.amount, 'used_amount', NEW.used_amount));
     END`,
  ];
}
app.listen(PORT, () => {
  console.log(`\n🚀 MySQL Local Server is running on http://localhost:${PORT}`);
  console.log(`📡 API Endpoint: POST http://localhost:${PORT}/api/mysql-manager`);
  console.log(`\nAvailable actions: test-connection, create-schema, delete-all-data, drop-all-tables\n`);
});
