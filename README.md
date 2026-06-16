# ビジコン用グループ予定調整Webアプリ

ビジコン・ゼミ・チーム活動で「いつ集まって作業できるか」を決めるための、GitHub Pagesで公開できる静的Webアプリです。

メンバーは共有URLから参加し、候補日時ごとに `○ 参加できる` / `△ 条件付き` / `× 参加できない` を入力できます。全員の回答は表形式で集計され、最も集まりやすい候補を確認できます。

## 1. アプリの概要

主な機能は以下です。

- グループ作成
- グループ専用共有URLの発行
- メンバー参加
- 候補日時の追加
- 候補日時ごとの参加可否入力
- 回答表の自動集計
- 最有力 / 候補 / 微妙 の判定表示
- 確定日時の登録
- 確定した作業日の進行管理メモ
  - 今日やること
  - 決定事項
  - 次回までの宿題
  - 担当者メモ

ログイン、通知、Googleカレンダー連携、AI自動調整、シフト勤務管理、給与計算は入れていません。

## 2. ファイル構成

```text
.
├── index.html
├── style.css
├── app.js
├── README.md
└── supabase-schema.sql
```

フレームワークは使っていません。HTML / CSS / JavaScript / Supabaseだけで動きます。

## 3. Supabaseの作成方法

1. Supabaseにログインします。
2. New project を押します。
3. Project name を入力します。
   - 例：`bizcon-scheduler`
4. Database Password を設定します。
5. Region は日本から使うなら Tokyo など近い地域を選びます。
6. Create new project を押します。
7. プロジェクト作成が完了するまで待ちます。

## 4. SupabaseでSQLを実行する方法

1. Supabaseのプロジェクト画面を開きます。
2. 左メニューの SQL Editor を開きます。
3. New query を押します。
4. `supabase-schema.sql` の中身をすべてコピーして貼り付けます。
5. Run を押します。
6. Table Editor に以下のテーブルが作成されていれば成功です。
   - `groups`
   - `members`
   - `time_slots`
   - `responses`
   - `meeting_notes`

## 5. Supabase URLとanon keyの設定場所

`app.js` の上部にある以下の2行を書き換えてください。

```js
const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

Supabase側では以下の場所から確認できます。

1. Supabaseプロジェクトを開く
2. Project Settings を開く
3. API を開く
4. Project URL を `SUPABASE_URL` に入れる
5. Project API keys の `anon public` を `SUPABASE_ANON_KEY` に入れる

注意：`service_role` key や secret key は絶対に `app.js` に入れないでください。GitHub Pagesに公開すると誰でも見られてしまいます。

## 6. GitHub Pagesで公開する方法

1. GitHubで新しいリポジトリを作成します。
2. この5ファイルをアップロードします。
   - `index.html`
   - `style.css`
   - `app.js`
   - `README.md`
   - `supabase-schema.sql`
3. リポジトリの Settings を開きます。
4. 左メニューの Pages を開きます。
5. Build and deployment の Source を `Deploy from a branch` にします。
6. Branch を `main`、Folder を `/root` にします。
7. Save を押します。
8. 数十秒後にGitHub PagesのURLが表示されます。

公開URL例：

```text
https://ユーザー名.github.io/リポジトリ名/
```

グループ作成後は以下のような共有URLになります。

```text
https://ユーザー名.github.io/リポジトリ名/?group=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

## 7. RLSポリシーの説明

`supabase-schema.sql` では、全テーブルでRLSを有効にしています。

最初の運用では「共有URLを知っている人が使える」前提にしているため、`anon` ユーザーに以下を許可しています。

- `groups`
  - select
  - insert
- `members`
  - select
  - insert
  - update
- `time_slots`
  - select
  - insert
  - update
- `responses`
  - select
  - insert
  - update
- `meeting_notes`
  - select
  - insert
  - update

削除は許可していません。

将来的に管理者認証を追加する場合は、以下を改善してください。

- 管理者だけが候補日時を確定できるようにする
- 管理者だけが候補日時を編集・削除できるようにする
- メンバー本人だけが自分の回答を更新できるようにする
- グループごとに招待コードを設定する
- Supabase Authを導入する

## 8. 使い方

### グループ作成者

1. アプリを開きます。
2. グループ名、説明、目的、管理者名を入力します。
3. 「グループを作成」を押します。
4. 共有URLをコピーします。
5. LINEなどでメンバーに送ります。

### メンバー

1. 共有URLを開きます。
2. メンバー名を入力します。
3. 必要なら役割・メモを入力します。
4. 「参加する / 更新する」を押します。
5. 各候補日時に対して○△×を選びます。
6. 必要ならコメントを入力します。
7. 「保存」を押します。

### 候補日時を追加する

1. 日付、開始時間、終了時間を入力します。
2. 作業内容、場所、メモを入力します。
3. 「候補日時を追加」を押します。

### 日時を確定する

1. 候補日時一覧を見る。
2. 回答表と判定を確認する。
3. 良さそうな候補の「この日時で確定」を押す。
4. 確定した作業予定が上部に表示されます。

### 進行管理メモを書く

1. 候補日時を確定します。
2. 下部の「ビジコン進行管理メモ」を開きます。
3. 今日やること、決定事項、次回までの宿題、担当者メモを入力します。
4. 「メモを保存」を押します。

## 9. 注意点

- このアプリは最小構成です。
- 共有URLを知っている人はデータを閲覧・追加・更新できます。
- 個人情報や機密情報は入れすぎないでください。
- 本格運用する場合は、Supabase Authや管理者権限を追加してください。
- ブラウザのlocalStorageに現在のメンバーIDを保存しています。別端末では再度名前入力が必要です。
