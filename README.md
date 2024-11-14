# DevFestMN

This project is an Angular CLI project.

## Summary

1. `yarn setup`
2. Create local branch and make changes
3. `ng serve`
4. Submit PR
5. Merge PR into master
6. Deployment will happen automatically

## Project Setup

When you first checkout the repo, run `yarn setup` to install all dependencies.

Install Firebase Tools by running `npm install -g firebase-tools` and run `firebase login` to authenticate for deployment permissions.

## Development Server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.

Run `ng serve -o` to have the browser open once the initial build is complete.

## Pushing to GitHub

Create a branch and push a pull request to GitHub. Once the PR has successfully built, and has been approved and merged, the update will be automatically be pushed to Firebase Hosting.

## Deploying to live http://devfest.mn website

Will happen automatically upon merge to main.
