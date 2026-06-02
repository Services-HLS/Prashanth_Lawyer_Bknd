-- =============================================================================
-- Prasanth Lawyer App — MySQL schema extensions
-- Path: backend/database/schema-extensions.sql
-- Run AFTER base-schema.sql (same folder).
-- Review and run in order. Adjust ENGINE/charset to match your environment.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ALTER: articles
-- -----------------------------------------------------------------------------
ALTER TABLE articles
  ADD COLUMN external_url VARCHAR(1000) NULL AFTER featured_image,
  ADD COLUMN cta_type ENUM('external', 'contact', 'qa', 'internal') NULL AFTER external_url,
  ADD COLUMN read_time_minutes INT NULL AFTER cta_type,
  ADD COLUMN publisher_label VARCHAR(200) NULL AFTER read_time_minutes,
  ADD COLUMN is_featured TINYINT(1) NOT NULL DEFAULT 0 AFTER publisher_label,
  ADD COLUMN display_order INT NOT NULL DEFAULT 0 AFTER is_featured,
  ADD COLUMN content_format ENUM('html', 'markdown') NOT NULL DEFAULT 'html' AFTER content,
  ADD COLUMN court_or_source VARCHAR(200) NULL AFTER category;

ALTER TABLE articles
  ADD INDEX idx_is_featured (is_featured),
  ADD INDEX idx_display_order (display_order),
  ADD INDEX idx_type (type);

-- -----------------------------------------------------------------------------
-- 2. ALTER: topics
-- -----------------------------------------------------------------------------
ALTER TABLE topics
  ADD COLUMN topic_kind ENUM('writing_category', 'practice_area') NOT NULL DEFAULT 'writing_category' AFTER type,
  ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER article_count,
  ADD COLUMN summary TEXT NULL AFTER description,
  ADD COLUMN sub_tags JSON NULL AFTER summary,
  ADD COLUMN card_number VARCHAR(10) NULL AFTER sub_tags;

ALTER TABLE topics
  ADD INDEX idx_topic_kind (topic_kind),
  ADD INDEX idx_sort_order (sort_order);

-- -----------------------------------------------------------------------------
-- 3. ALTER: about
-- -----------------------------------------------------------------------------
ALTER TABLE about
  MODIFY COLUMN slug VARCHAR(500) NOT NULL,
  ADD COLUMN meta_title VARCHAR(500) NULL AFTER slug,
  ADD COLUMN meta_description TEXT NULL AFTER meta_title,
  ADD COLUMN hero_json JSON NULL AFTER content,
  ADD COLUMN recognitions JSON NULL AFTER hero_json;

ALTER TABLE about
  ADD UNIQUE INDEX idx_about_slug (slug);

-- -----------------------------------------------------------------------------
-- 4. ALTER: podcasts
-- -----------------------------------------------------------------------------
ALTER TABLE podcasts
  ADD COLUMN summary TEXT NULL AFTER slug,
  ADD COLUMN video_url VARCHAR(1000) NULL AFTER audio_url;

-- -----------------------------------------------------------------------------
-- 5. NEW: practice_areas (preferred over overloading topics)
-- -----------------------------------------------------------------------------
CREATE TABLE practice_areas (
  id VARCHAR(50) PRIMARY KEY,
  slug VARCHAR(500) NOT NULL UNIQUE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  icon VARCHAR(50) DEFAULT '⚖️',
  card_number VARCHAR(10) NULL,
  sub_tags JSON NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_sort_order (sort_order)
);

-- -----------------------------------------------------------------------------
-- 6. NEW: timeline_entries
-- -----------------------------------------------------------------------------
CREATE TABLE timeline_entries (
  id VARCHAR(50) PRIMARY KEY,
  section ENUM('about', 'credentials') NOT NULL DEFAULT 'about',
  year_label VARCHAR(20) NOT NULL,
  title VARCHAR(500) NOT NULL,
  subtitle TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  status ENUM('draft', 'published') NOT NULL DEFAULT 'published',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_section (section),
  INDEX idx_sort_order (sort_order),
  INDEX idx_status (status)
);

-- -----------------------------------------------------------------------------
-- 7. NEW: memberships
-- -----------------------------------------------------------------------------
CREATE TABLE memberships (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  subtitle VARCHAR(500) NULL,
  icon VARCHAR(50) DEFAULT '📋',
  sort_order INT NOT NULL DEFAULT 0,
  status ENUM('draft', 'published') NOT NULL DEFAULT 'published',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sort_order (sort_order),
  INDEX idx_status (status)
);

-- -----------------------------------------------------------------------------
-- 8. NEW: speaking_events
-- -----------------------------------------------------------------------------
CREATE TABLE speaking_events (
  id VARCHAR(50) PRIMARY KEY,
  event_date DATE NULL,
  month_label VARCHAR(20) NULL,
  day_label VARCHAR(10) NULL,
  event_type ENUM('seminar', 'panel', 'moot', 'talk', 'other') NOT NULL DEFAULT 'other',
  title VARCHAR(500) NOT NULL,
  venue VARCHAR(500) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_event_date (event_date),
  INDEX idx_status (status),
  INDEX idx_sort_order (sort_order)
);

-- -----------------------------------------------------------------------------
-- 9. NEW: collaboration_services
-- -----------------------------------------------------------------------------
CREATE TABLE collaboration_services (
  id VARCHAR(50) PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  icon VARCHAR(50) DEFAULT '⚖️',
  cta_label VARCHAR(200) NULL,
  cta_target VARCHAR(500) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sort_order (sort_order),
  INDEX idx_status (status)
);

-- -----------------------------------------------------------------------------
-- 10. NEW: resources
-- -----------------------------------------------------------------------------
CREATE TABLE resources (
  id VARCHAR(50) PRIMARY KEY,
  slug VARCHAR(500) NOT NULL UNIQUE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  resource_type ENUM('checklist', 'guide', 'explainer', 'template', 'other') NOT NULL DEFAULT 'guide',
  icon VARCHAR(50) DEFAULT '📄',
  file_url VARCHAR(1000) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_slug (slug),
  INDEX idx_sort_order (sort_order)
);

-- -----------------------------------------------------------------------------
-- 11. NEW: testimonials
-- -----------------------------------------------------------------------------
CREATE TABLE testimonials (
  id VARCHAR(50) PRIMARY KEY,
  quote TEXT NOT NULL,
  author_initials VARCHAR(10) NULL,
  author_name VARCHAR(200) NULL,
  author_role VARCHAR(500) NULL,
  rating TINYINT UNSIGNED NOT NULL DEFAULT 5,
  sort_order INT NOT NULL DEFAULT 0,
  status ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sort_order (sort_order),
  INDEX idx_status (status)
);

-- -----------------------------------------------------------------------------
-- 12. NEW: newsletter_subscriptions
-- -----------------------------------------------------------------------------
CREATE TABLE newsletter_subscriptions (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(200) NULL,
  email VARCHAR(320) NOT NULL,
  interest VARCHAR(200) NULL,
  status ENUM('active', 'unsubscribed') NOT NULL DEFAULT 'active',
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(500) NULL,
  subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  unsubscribed_at TIMESTAMP NULL,
  INDEX idx_email (email),
  INDEX idx_status (status),
  INDEX idx_subscribed_at (subscribed_at)
);

-- -----------------------------------------------------------------------------
-- 13. NEW: contact_inquiries
-- -----------------------------------------------------------------------------
CREATE TABLE contact_inquiries (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  email VARCHAR(320) NOT NULL,
  matter_type VARCHAR(200) NULL,
  message TEXT,
  contact_preference VARCHAR(100) NULL,
  status ENUM('new', 'read', 'replied', 'archived') NOT NULL DEFAULT 'new',
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_email (email),
  INDEX idx_created_at (created_at)
);

-- -----------------------------------------------------------------------------
-- 14. NEW: site_settings (key-value)
-- -----------------------------------------------------------------------------
CREATE TABLE site_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value JSON NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 15. NEW: ticker_items
-- -----------------------------------------------------------------------------
CREATE TABLE ticker_items (
  id VARCHAR(50) PRIMARY KEY,
  label VARCHAR(500) NOT NULL,
  highlight_text VARCHAR(500) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sort_order (sort_order),
  INDEX idx_is_active (is_active)
);

-- -----------------------------------------------------------------------------
-- 16. NEW: publication_logos
-- -----------------------------------------------------------------------------
CREATE TABLE publication_logos (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  url VARCHAR(1000) NULL,
  logo_url VARCHAR(1000) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sort_order (sort_order),
  INDEX idx_is_active (is_active)
);

-- -----------------------------------------------------------------------------
-- 17. NEW: contact_details
-- -----------------------------------------------------------------------------
CREATE TABLE contact_details (
  id VARCHAR(50) PRIMARY KEY,
  icon VARCHAR(50) DEFAULT '🔗',
  label VARCHAR(200) NOT NULL,
  value TEXT NOT NULL,
  link_url VARCHAR(1000) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status ENUM('draft', 'published') NOT NULL DEFAULT 'published',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sort_order (sort_order),
  INDEX idx_status (status)
);

-- -----------------------------------------------------------------------------
-- 18. NEW: social_links
-- -----------------------------------------------------------------------------
CREATE TABLE social_links (
  id VARCHAR(50) PRIMARY KEY,
  platform VARCHAR(100) NOT NULL,
  label VARCHAR(100) NULL,
  url VARCHAR(1000) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status ENUM('draft', 'published') NOT NULL DEFAULT 'published',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sort_order (sort_order),
  INDEX idx_status (status)
);

-- -----------------------------------------------------------------------------
-- 19. OPTIONAL: article_topics (many-to-many)
-- -----------------------------------------------------------------------------
CREATE TABLE article_topics (
  article_id VARCHAR(50) NOT NULL,
  topic_id VARCHAR(50) NOT NULL,
  PRIMARY KEY (article_id, topic_id),
  INDEX idx_topic_id (topic_id),
  CONSTRAINT fk_article_topics_article
    FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
  CONSTRAINT fk_article_topics_topic
    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- 20. OPTIONAL: ai_chat_logs
-- -----------------------------------------------------------------------------
CREATE TABLE ai_chat_logs (
  id VARCHAR(50) PRIMARY KEY,
  session_id VARCHAR(100) NULL,
  channel ENUM('qa', 'floating_chat') NOT NULL DEFAULT 'qa',
  user_message TEXT NOT NULL,
  assistant_message TEXT NULL,
  ip_address VARCHAR(45) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_session_id (session_id),
  INDEX idx_channel (channel),
  INDEX idx_created_at (created_at)
);

-- -----------------------------------------------------------------------------
-- 21. OPTIONAL: admin_users
-- -----------------------------------------------------------------------------
CREATE TABLE admin_users (
  id VARCHAR(50) PRIMARY KEY,
  email VARCHAR(320) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(200) NULL,
  role ENUM('admin', 'editor') NOT NULL DEFAULT 'editor',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_is_active (is_active)
);

-- -----------------------------------------------------------------------------
-- 22. UPDATE: about default row (replace placeholder)
-- -----------------------------------------------------------------------------
UPDATE about
SET
  title = 'About Prasanth Raju',
  slug = 'about',
  description = 'From Engineer to Advocate — career and background of Prasanth Raju.',
  content = '<p>Replace with CMS-managed about narrative.</p>',
  status = 'published'
WHERE id = '1';
