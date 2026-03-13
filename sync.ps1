# Get the folder of the script
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
cd $scriptPath

# Read repos.txt
$repos = Get-Content "$scriptPath\repos.txt"

Write-Host "Scanning repositories..."

# الحصول على كود Hash للمستودع المحلي للمقارنة
$localHash = git rev-parse HEAD 2>$null
$latestRepo = ""

foreach ($repo in $repos) {
    $remote = git ls-remote $repo HEAD
    if ($remote) {
        $hash = $remote.Split("`t")[0]
        
        # مقارنة الـ Hash الخارجي مع المحلي لاكتشاف التحديث الفعلي
        if ($hash -ne $localHash -and [string]::IsNullOrWhiteSpace($hash) -eq $false) {
            Write-Host "Update detected in: $repo"
            $latestRepo = $repo
            break # نوقف البحث بمجرد العثور على أول مستودع محدث
        }
    }
}

# إذا لم يكن هناك أي تحديث، نوقف السكريبت لتخفيف العبء
if ($latestRepo -eq "") {
    Write-Host "No new changes detected in any repository."
    return
}

Write-Host "Pulling latest changes from:"
Write-Host $latestRepo

# Pull latest changes from the repo with a fixed commit message
git pull $latestRepo main --allow-unrelated-histories -m "auto merge by sync script"

# Ensure there is at least one commit (if repo was empty)
git add . 2>$null
try { git commit -m "auto commit by sync script" } catch {}

Write-Host "Pushing to all repositories..."

# Push to all repos in parallel
$jobs = @()

foreach ($repo in $repos) {
    $jobs += Start-Job -ScriptBlock {
        param($r, $path)
        
        # الانتقال إلى مسار المستودع داخل الجلسة الخلفية
        Set-Location $path
        git push $r main --force
        
    } -ArgumentList $repo, $scriptPath
}

$jobs | Wait-Job

# عرض أي أخطاء قد تحدث أثناء الرفع للتمكن من مراجعتها
$jobs | Receive-Job 
$jobs | Remove-Job

Write-Host "All repositories synced successfully."