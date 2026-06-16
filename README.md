# グループ予定調整 Webアプリ

ビジコン・ゼミ・チーム活動で、候補日時ごとの参加可否を共有するための最小構成Webアプリです。

## 構成

- `index.html`
- `style.css`
- `app.js`
- `supabase-schema.sql`
- `README.md`

HTML/CSS/JavaScriptだけで作っています。フレームワークは使っていません。

## Supabase設定

この版の `app.js` には以下を設定済みです。

```js
const SUPABASE_URL = 'https://dgaveiimlslljluimqxn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_JPpJW8RmeDVGESJtJatwbA_IH6PIXKE';
```

`sb_publishable_...` は公開Webアプリで使う公開用キーです。`service_role` や `secret` は絶対に入れないでください。

## SupabaseでSQLを実行する方法

1. Supabaseのプロジェクトを開く
2. 左メニューの `SQL Editor` を開く
3. `New query` を押す
4. `supabase-schema.sql` の中身を全部貼る
5. `Run` を押す
6. `Table Editor` に以下があるか確認する
   - `groups`
   - `members`
   - `time_slots`
   - `responses`
   - `meeting_notes`

## RLSポリシー

RLSは有効化しています。最初は招待URLを知っている人が使える前提なので、anonユーザーに以下を許可しています。

- select
- insert
- update

削除は許可していません。

## GitHub Pagesで公開する方法

1. GitHubリポジトリに以下をアップロードする
   - `index.html`
   - `style.css`
   - `app.js`
   - `README.md`
   - `supabase-schema.sql`
2. `Settings` → `Pages`
3. `Branch` を `main`、フォルダを `/root` にする
4. `Save`
5. 表示されたGitHub Pages URLを開く

## キャッシュ対策

この版では `index.html` 内で以下のように読み込んでいます。

```html
<link rel="stylesheet" href="./style.css?v=4" />
<script src="./app.js?v=4"></script>
```

前の古い `app.js` がブラウザに残っていても、新しいファイルを読み込みやすくしています。

## 使い方

1. トップ画面でグループを作成する
2. 発行された `?group=...` 付きURLをコピーする
3. LINEなどで共有する
4. メンバーが名前を入力して参加する
5. 候補日時を追加する
6. 各メンバーが○△×とコメントを入力する
7. 回答表で集まりやすい日時を確認する
8. 「この日時で確定」を押す
9. 確定した作業日に対して、ToDo・決定事項・宿題を保存する
