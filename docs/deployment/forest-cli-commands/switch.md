# switch

The `forest switch` command allows you to **set your current branch** to the selected branch:

```
$ forest switch --help
Switch to another branch in your local development environment.

USAGE
  $ forest switch [BRANCH_NAME]

ARGUMENTS
  BRANCH_NAME  The name of the local branch to set as current.

OPTIONS
  --help  Display usage information.
```

#### Branch selection

You can switch directly to a specific branch by using `forest branch <my_branch_name>`, while omitting the branch name will allow you to easy select one:

```
$ forest switch
[? Select the branch you want to set-current:
feature/add-new-smart-view-with-information
hotfix/fix-dropdown-issue
feature/implement-refund-smart-action 
```
