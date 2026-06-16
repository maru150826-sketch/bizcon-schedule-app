# SAMPO QUEST ビジコン予定調整アプリ

GitHub PagesとSupabaseで動く、ビジコンチーム用の予定調整Webアプリです。

この版では、グループURLやグループコードを使いません。アプリURLを開くと、自動で `SAMPO QUEST ビジコンチーム` の共有予定表が表示されます。

## 機能

- メンバー名を入力して参加
- 日付＋時間帯ボタンで候補日時を簡単追加
- 作業内容・場所をプリセットボタンで入力
- 候補日時ごとに ○ / △ / × を回答
- コメント入力
- 全員の回答表
- 最有力候補の判定
- 確定日時の登録
- 確定日に対するToDo、決定事項、宿題、担当者メモ

## ファイル構成

```txt
index.html
style.css
app.js
supabase-schema.sql
README.md
```

## GitHub Pagesで公開する方法

1. GitHubのリポジトリを開く
2. この5ファイルをアップロードする
3. `Settings` → `Pages`
4. Branchを `main`、Folderを `/root` にする
5. Save
6. 表示されたGitHub PagesのURLを開く

## Supabaseの設定

### 1. SQLを実行する

Supabaseの管理画面で、左メニューの `SQL Editor` を開きます。

`supabase-schema.sql` の中身をすべて貼り付けて、`Run` を押してください。

既に前のSQLを実行していても、再実行できます。今回のSQLでは `groups` テーブルに `app_key` を追加します。

### 2. テーブル確認

`Table Editor` で以下のテーブルがあればOKです。

```txt
groups
members
time_slots
responses
meeting_notes
```

## Supabase URLと公開キー

`app.js` の上部で設定します。

```js
const SUPABASE_URL = 'https://dgaveiimlslljluimqxn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_JPpJW8RmeDVGESJtJatwbA_IH6PIXKE';
```

`/rest/v1/` は入れません。

`service_role` や `sb_secret_` は絶対にGitHubに置かないでください。

## 使い方

1. GitHub PagesのアプリURLを開く
2. 名前を入力して参加
3. 日付を選ぶ
4. 時間帯ボタンを押す
5. 作業内容・場所を押す
6. 候補日時を追加
7. 各メンバーが ○ / △ / × を回答
8. 回答表で集まりやすい日時を見る
9. 「この日時で確定」を押す
10. 確定日のToDoや宿題を記録する

## 固定チームモードについて

このアプリは `app_key = sampo-quest-main` のグループを自動で探します。

見つからない場合は、アプリが自動で以下のグループを作成します。

```txt
SAMPO QUEST ビジコンチーム
```

そのため、共有URLやグループコードを使わず、同じアプリURLだけでチーム内の予定調整ができます。
