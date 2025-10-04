# Release Process

1. Choose a semantic version bump and run:
   ```sh
   npm version patch   # or minor | major
   ```
2. Push commits and tags:
   ```sh
   git push
   git push --tags
   ```
3. Create a GitHub Release for the new tag and attach (optionally) the zipped `dist/` artifact produced by CI.
4. Reminder: never commit API keys. Configure the Gemini key via the extension Options page or a secure proxy.
