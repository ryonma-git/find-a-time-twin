# Find a Time Twin! Web

SwiftUI App Playground版の活動データと操作を、静的なWebアプリへ移植したものです。通信・ログイン・バックエンドを必要とせず、GitHub Pagesで配信できます。

- 公開版: https://ryonma-git.github.io/find-a-time-twin/
- 公開用リポジトリ: https://github.com/ryonma-git/find-a-time-twin

## ローカル確認

親ディレクトリでSwiftの正本からデータを再生成します。

```sh
bash scripts/build-web-data.sh
cd web
npm test
python3 -m http.server 4173
```

ブラウザで `http://localhost:4173/` を開きます。`file://` ではデータ取得が制限されるため、ローカルサーバーを使ってください。

`data.json` は `FindATimeTwin.swiftpm/Models/DatasetCatalog.swift` から生成します。データセットを変更した場合は必ず再生成し、Swift側のコアテストとWeb側のテストを両方実行してください。

正本は非公開の `Eigo-Flashcards-Prototype` リポジトリにある `Gr4_Find_a_time_Twin_app/web/` です。公開用リポジトリの `main` は、このディレクトリを `git subtree split` して同期します。公開用リポジトリだけで先行編集すると次回同期で差分が分かれるため、通常の修正は正本側から行ってください。
