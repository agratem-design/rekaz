$repos = Get-Content repos.txt

foreach ($repo in $repos) {

    $url = "https://github.com/$repo.git"

    $name = $repo.Split("/")[1]

    Write-Host "Cloning $repo"

    git clone --mirror $url "$name.git"

}