# SAMPO QUEST 空き時間調整アプリ v21

GitHub Pages と Supabase で動く、ビジコンチーム向けの予定調整Webアプリです。

## v21の方針

この版では、入力作業を減らして「出てきた候補に乗る」使い方を優先しました。

主な変更点:

- 確定した作業予定を画面上部に大きく表示
- 自分の名前を上部で選べるように配置
- 2人以上が重なっている時間だけを「集まりそうな時間」として表示
- 候補に対して「参加できる」を押すだけで自分の空き時間として追加
- 「この時間で確定」を候補カードから直接押せる
- 空き時間の手入力は折りたたみ式に変更
- 週選択を「今週 / 来週 / 再来週」中心に変更
- 入力済み / 未入力のメンバーを表示
- 場所入力は削除

## ファイル構成

- `index.html`
- `style.css`
- `app.js`
- `supabase-schema.sql`
- `README.md`

## GitHub Pagesへの反映

GitHubの `bizcon-schedule-app` リポジトリに、以下を上書きアップロードしてください。

- `index.html`
- `style.css`
- `app.js`
- `README.md`
- `supabase-schema.sql`

最低限、画面反映だけなら以下3ファイルでも動きます。

- `index.html`
- `style.css`
- `app.js`

アップロード後、公開ページを開き直してください。

PC:

```txt
Ctrl + F5
```

スマホ:

```txt
https://maru150826-sketch.github.io/bizcon-schedule-app/?v=21
```

## Supabaseについて

v11以降の `supabase-schema.sql` を実行済みなら、v21で新しいテーブル追加は基本的に不要です。

必要な主なテーブル:

- `groups`
- `members`
- `availability_slots`
- `time_slots`
- `responses`
- `meeting_notes`

## Supabase設定場所

`app.js` の上部にあります。

```js
const SUPABASE_URL = 'https://dgaveiimlslljluimqxn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_JPpJW8RmeDVGESJtJatwbA_IH6PIXKE';
```

`/rest/v1/` は付けません。

`service_role` や `secret key` は絶対に入れないでください。
