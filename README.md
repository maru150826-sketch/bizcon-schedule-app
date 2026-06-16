# SAMPO QUEST ビジコン予定調整アプリ

GitHub Pages + Supabaseで動く、固定チーム専用の予定調整Webアプリです。
グループURLやグループコードは使わず、アプリを開くと自動でSAMPO QUESTチームの予定表を表示します。

## 今回の主な機能

- 名前を入力してメンバー参加
- 候補日を追加
- 開始時間・終了時間を30分刻みで選択
- 作業内容を複数選択
- 作業内容メモ、候補日メモを追記
- 場所は「Zoom」「大学」のみ
- 候補日に対して○ / △ / × を押すだけで回答保存
- 他メンバーの投票状況を候補日ごとに表示
- 未回答者を表示
- ○+△が多く、×が少ない候補を「最有力」として表示
- 候補から確定日時を登録
- 確定日時に対して、今日やること・決定事項・宿題・担当者メモを保存
- 30秒ごとに自動更新
- 自分の回答者データを削除
- 自分が追加した候補日を削除

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
3. `Settings` → `Pages` を開く
4. `Branch` を `main`、フォルダを `/root` にする
5. 保存する
6. 表示されたGitHub Pages URLを開く

反映に1〜5分かかることがあります。

## Supabaseの作成方法

1. Supabaseで新規プロジェクトを作成
2. 左メニューの `SQL Editor` を開く
3. `New query` を押す
4. `supabase-schema.sql` の中身を全部貼る
5. `Run` を押す
6. `Table Editor` で以下のテーブルができているか確認

```txt
groups
members
time_slots
responses
meeting_notes
```

## Supabase URLとpublishable keyの設定場所

`app.js` の上部にあります。

```js
const SUPABASE_URL = 'https://dgaveiimlslljluimqxn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_JPpJW8RmeDVGESJtJatwbA_IH6PIXKE';
```

`/rest/v1/` は入れません。

使ってよいのは `sb_publishable_...` の公開用キーです。
`sb_secret_...` や `service_role` は絶対に入れないでください。

## RLSポリシー

`supabase-schema.sql` ではRLSを有効にしています。
最初はチーム内だけで使う前提なので、anonユーザーに以下を許可しています。

- groups: select / insert / update
- members: select / insert / update
- time_slots: select / insert / update
- responses: select / insert / update
- meeting_notes: select / insert / update

通常のDELETEポリシーは使っていません。代わりにRPC関数で、ブラウザ内に保存した端末トークンを使い「この端末で作った回答者・候補日か」を確認してから削除します。

追加されるRPC関数：

```txt
delete_member_if_owner
delete_time_slot_if_owner
```

ログインなしの簡易方式なので、厳密な本人認証ではありません。チーム内だけで使う最小構成です。

## 使い方

1. アプリURLを開く
2. 自分の名前を入力して参加
3. 候補日を追加する場合は、日付・時間・作業内容・場所を選んで追加
4. 各候補日に対して○ / △ / × を押す
5. 他の人の回答状況と未回答者を見る
6. 自分が追加した候補日は「この候補日を削除」から削除する
7. 自分の回答者データは「自分の回答者データを削除」から削除する
8. ○+△が多く、×が少ない候補を確定する
9. 確定後、作業メモを記録する
