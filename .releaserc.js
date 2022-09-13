module.exports = {
  branches: [
    'main',
    {
      name: 'beta',
      prerelease: true,
    },
    {
      name: 'alpha',
      prerelease: true,
    },
    {
      name: 'beta-[-a-zA-Z]+',
      prerelease: true,
    },
    {
      name: 'alpha-[-a-zA-Z]+',
      prerelease: true,
    },
  ],
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        releaseRules: [
          {
            scope: 'force-release',
            release: 'patch',
          },
        ],
      },
    ],
    '@semantic-release/release-notes-generator',
    '@semantic-release/changelog',
    '@semantic-release/npm',
    [
      '@semantic-release/git',
      {
        message: 'chore(release): ${nextRelease.gitTag} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
    '@semantic-release/github',
    [
      'semantic-release-slack-bot',
      {
        markdownReleaseNotes: true,
        notifyOnSuccess: true,
        notifyOnFail: false,
        onSuccessTemplate: {
          text: '📦 $package_name@$npm_package_version has been released!',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*New `$package_name` package released!*',
              },
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: '📦  *Version:* <$repo_url/releases/tag/v$npm_package_version|$npm_package_version>',
                },
              ],
            },
            {
              type: 'divider',
            },
          ],
          attachments: [
            {
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: '*Changes* of version $release_notes',
                  },
                },
              ],
            },
          ],
        },
      },
    ],
  ],
};
