$repos = Get-Content repos.txt
$i = 1

foreach ($repo in $repos) {
    $name = "repo$i"
    git remote add $name $repo
    Write-Host "Added $name -> $repo"
    $i++
}