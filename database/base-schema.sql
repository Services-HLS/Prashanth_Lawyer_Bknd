-- Base schema (run first, then schema-extensions.sql)

CREATE TABLE articles (
    id VARCHAR(50) PRIMARY KEY,
    type VARCHAR(20) DEFAULT 'article',
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(500) UNIQUE NOT NULL,
    description TEXT,
    content LONGTEXT,
    category VARCHAR(200),
    tags TEXT,
    featured_image VARCHAR(1000),
    author VARCHAR(200),
    publish_date DATETIME,
    status ENUM('draft', 'published') DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_slug (slug),
    INDEX idx_publish_date (publish_date)
);

CREATE TABLE topics (
    id VARCHAR(50) PRIMARY KEY,
    type VARCHAR(20) DEFAULT 'topic',
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(500) UNIQUE NOT NULL,
    description TEXT,
    icon VARCHAR(50) DEFAULT '📌',
    article_count INT DEFAULT 0,
    status ENUM('draft', 'published') DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_slug (slug)
);

CREATE TABLE books (
    id VARCHAR(50) PRIMARY KEY,
    type VARCHAR(20) DEFAULT 'book',
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(500) UNIQUE NOT NULL,
    description TEXT,
    author VARCHAR(200),
    cover_image VARCHAR(1000),
    buy_link VARCHAR(1000),
    publication_date DATE,
    publisher VARCHAR(200),
    isbn VARCHAR(20),
    status ENUM('draft', 'published') DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_slug (slug)
);

CREATE TABLE podcasts (
    id VARCHAR(50) PRIMARY KEY,
    type VARCHAR(20) DEFAULT 'podcast',
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(500) UNIQUE NOT NULL,
    summary TEXT,
    description TEXT,
    audio_url VARCHAR(1000),
    video_url VARCHAR(1000),
    duration VARCHAR(20),
    episode_number INT,
    platform_links JSON,
    guest_name VARCHAR(200),
    cover_image VARCHAR(1000),
    status ENUM('draft', 'published') DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_slug (slug)
);

CREATE TABLE about (
    id VARCHAR(50) PRIMARY KEY,
    type VARCHAR(20) DEFAULT 'about',
    title VARCHAR(500),
    slug VARCHAR(500),
    description TEXT,
    content LONGTEXT,
    status ENUM('draft', 'published') DEFAULT 'published',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO about (id, type, title, slug, description, content, status)
VALUES (
    '1',
    'about',
    'About Prasanth Raju',
    'about',
    'Advocate & Counsel',
    '<p>About content managed via CMS.</p>',
    'published'
) ON DUPLICATE KEY UPDATE title = VALUES(title);
