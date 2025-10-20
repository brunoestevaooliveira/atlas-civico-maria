
-- =================================================================
-- Script SQL para o Schema do Banco de Dados do "Atlas Cívico"
--
-- Objetivo: Modelar a estrutura de dados para engenharia reversa
-- no MySQL Workbench, seguindo a Terceira Forma Normal (3NF).
-- =================================================================

-- Desabilita a verificação de chaves estrangeiras para permitir a criação das tabelas em qualquer ordem.
SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- Criação do Schema (Banco de Dados) se ele não existir.
CREATE SCHEMA IF NOT EXISTS `atlas_civico_db` DEFAULT CHARACTER SET utf8mb4 ;
USE `atlas_civico_db` ;

-- -----------------------------------------------------
-- Tabela `Users`
-- Armazena os dados dos usuários da plataforma.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `atlas_civico_db`.`Users` (
  `uid` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `name` VARCHAR(255) NULL,
  `photoURL` VARCHAR(2048) NULL,
  `role` ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`uid`),
  UNIQUE INDEX `email_UNIQUE` (`email` ASC) VISIBLE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Tabela `Categories`
-- Tabela de domínio para as categorias de ocorrências.
-- Isso evita a repetição de strings e facilita a manutenção.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `atlas_civico_db`.`Categories` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `name_UNIQUE` (`name` ASC) VISIBLE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Tabela `Issues`
-- Tabela principal, armazena todas as ocorrências reportadas.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `atlas_civico_db`.`Issues` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `status` ENUM('Recebido', 'Em análise', 'Resolvido') NOT NULL DEFAULT 'Recebido',
  `address` VARCHAR(500) NOT NULL,
  `latitude` DECIMAL(10, 8) NOT NULL,
  `longitude` DECIMAL(11, 8) NOT NULL,
  `imageUrl` VARCHAR(2048) NULL,
  `reportedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reporterId` VARCHAR(255) NOT NULL,
  `categoryId` INT NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_Issues_Users_idx` (`reporterId` ASC) VISIBLE,
  INDEX `fk_Issues_Categories_idx` (`categoryId` ASC) VISIBLE,
  CONSTRAINT `fk_Issues_Users`
    FOREIGN KEY (`reporterId`)
    REFERENCES `atlas_civico_db`.`Users` (`uid`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_Issues_Categories`
    FOREIGN KEY (`categoryId`)
    REFERENCES `atlas_civico_db`.`Categories` (`id`)
    ON DELETE RESTRICT
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Tabela `Comments`
-- Armazena os comentários feitos em cada ocorrência.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `atlas_civico_db`.`Comments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `content` TEXT NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `authorId` VARCHAR(255) NOT NULL,
  `issueId` INT NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_Comments_Users_idx` (`authorId` ASC) VISIBLE,
  INDEX `fk_Comments_Issues_idx` (`issueId` ASC) VISIBLE,
  CONSTRAINT `fk_Comments_Users`
    FOREIGN KEY (`authorId`)
    REFERENCES `atlas_civico_db`.`Users` (`uid`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_Comments_Issues`
    FOREIGN KEY (`issueId`)
    REFERENCES `atlas_civico_db`.`Issues` (`id`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Tabela `Upvotes`
-- Tabela de ligação para registrar os apoios (votos).
-- Garante que um usuário só possa apoiar uma ocorrência uma única vez.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `atlas_civico_db`.`Upvotes` (
  `userId` VARCHAR(255) NOT NULL,
  `issueId` INT NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`userId`, `issueId`),
  INDEX `fk_Upvotes_Issues_idx` (`issueId` ASC) VISIBLE,
  CONSTRAINT `fk_Upvotes_Users`
    FOREIGN KEY (`userId`)
    REFERENCES `atlas_civico_db`.`Users` (`uid`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_Upvotes_Issues`
    FOREIGN KEY (`issueId`)
    REFERENCES `atlas_civico_db`.`Issues` (`id`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- Inserção dos dados iniciais das categorias
INSERT INTO `Categories` (`name`) VALUES
('Limpeza urbana / Acúmulo de lixo'),
('Iluminação pública'),
('Saneamento / Vazamento de água'),
('Sinalização danificada'),
('Calçadas / Acessibilidade'),
('Trânsito / Superlotação ou parada de ônibus'),
('Meio ambiente (árvores quebradas, áreas destruídas)'),
('Segurança (como falta de policiamento, zonas escuras)'),
('Outros')
ON DUPLICATE KEY UPDATE name=name;


-- Habilita novamente a verificação de chaves estrangeiras.
SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
