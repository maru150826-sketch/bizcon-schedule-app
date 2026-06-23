# SAMPO QUEST 空き時間調整アプリ v20

GitHub Pages + Supabase で動く、ビジコンチーム用の予定調整Webアプリです。

## v20 の変更点

- 回答者選択を画面上部に配置
- 確定した作業予定を上の方に大きく表示
- 2人以上が重なっている時間だけを「集まりそうな時間」として上に表示
- 集まりそうな時間から、すぐに「自分もこの時間に入れる」を押せる
- 集まりそうな時間から、すぐに「この時間で確定」できる
- みんなの空き時間は確認用として下に表示
- 場所入力は削除
- 使い方説明は折りたたみ式

## 使い方

1. 自分の名前を選ぶ
2. 上の「集まりそうな時間」を見る
3. 行ける時間があれば「自分もこの時間に入れる」を押す
4. よさそうなら「この時間で確定」を押す
5. 確定した予定は画面上部に表示される
6. 必要なら共有メモや参加可否を追記する

## GitHub Pages に反映する方法

この5ファイルをリポジトリに上書きアップロードしてください。

- index.html
- style.css
- app.js
- README.md
- supabase-schema.sql

最低限、画面変更だけなら以下の3ファイルで反映されます。

- index.html
- style.css
- app.js

アップロード後、公開ページを開いて `Ctrl + F5` で強制更新してください。
スマホの場合はURL末尾に `?v=20` を付けて開いてください。

例：

```text
https://maru150826-sketch.github.io/bizcon-schedule-app/?v=20
```

## Supabaseについて

v11以降のSQLを実行済みで、以下のテーブルが存在していれば基本的に再実行不要です。

- groups
- members
- availability_slots
- time_slots
- responses
- meeting_notes

不安な場合は `supabase-schema.sql` をSupabaseのSQL Editorで再実行してください。

## Supabase URL / Key

`app.js` の上部で設定します。

```js
const SUPABASE_URL = 'https://dgaveiimlslljluimqxn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_JPpJW8RmeDVGESJtJatwbA_IH6PIXKE';
```

`service_role` や `sb_secret_` はGitHub Pagesに入れないでください。
