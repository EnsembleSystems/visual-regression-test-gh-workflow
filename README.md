# Visual Regression Testing with GitHub Workflows for Adobe Edge Delivery Services

A reference implementation demonstrating how to set up automated visual regression testing using BackstopJS and GitHub workflows, specifically designed for Adobe Edge Delivery Services (EDS) projects.

> **⚠️ Note**: This is a reference project only and is not intended for direct use. It serves as a template and guide for implementing visual regression testing in your own Adobe EDS projects.

## Overview

This repository serves as a template and reference for implementing visual regression testing in Adobe EDS projects. It demonstrates best practices for:

- **Automated visual testing** on pull requests using BackstopJS
- **Branch-based testing** comparing staging branches against production
- **GitHub workflow integration** with comprehensive reporting
- **Adobe EDS URL patterns** and environment-specific configurations

## Key Features

- **Multi-viewport testing** (phone, tablet, desktop)
- **Automated reference screenshot management**
- **PR integration** with detailed visual diff reports
- **Custom URL pair testing** via PR descriptions
- **Local development workflow** for testing custom branches
- **Artifact management** with automatic cleanup

## Quick Start

1. **Copy this repository** as a template for your Adobe EDS project
2. **Update `backstop.json`** with your project's URLs and scenarios
3. **Configure GitHub workflows** in `.github/workflows/`
4. **Run initial reference generation**: `npm run reference`
5. **Test your setup**: `npm run test`

## Architecture

This implementation uses:

- **BackstopJS** with Playwright engine for screenshot comparison
- **GitHub Actions** for automated testing workflows
- **Adobe EDS URL patterns** (`branch--project--org.aem.live`)
- **Artifact storage** for reference images and test results

## Usage in Your Project

1. Copy the workflow files to your `.github/workflows/` directory
2. Adapt the `backstop.json` configuration for your site structure
3. Update URL patterns to match your Adobe EDS project
4. Customize element selectors for your specific components
