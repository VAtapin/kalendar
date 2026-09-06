<?php
declare(strict_types=1);

function calendar_default_site_pages(): array {
    $block=fn(string $text)=>['type'=>'text','text'=>$text,'url'=>''];
    $make=function(string $id,string $slug,int $order,string $ruTitle,array $ru,string $deTitle,array $de)use($block){
        return ['id'=>$id,'slug'=>$slug,'order'=>$order,'published'=>true,'updatedAt'=>'2026-09-06T00:00:00Z','translations'=>[
            'ru'=>['title'=>$ruTitle,'blocks'=>array_map($block,$ru)],'de'=>['title'=>$deTitle,'blocks'=>array_map($block,$de)]]];
    };
    $contact="Volodymyr Atapin · ATAPIN.DE\nNeuhofer Straße 7\n16278 Angermünde, Deutschland\n+49 171 351 72 74\natapin@gmail.com";
    return [
        $make('c8f7905a-d26a-4bc8-926b-2ce80d200001','impressum',10,'Impressum — правовая информация',[
            'Оператор календарной мастерской и контакт для запросов на печать:',$contact,
            'Эти сведения относятся к kalender.georg-kloster.de и kalender.georg-kloster.ru. Монастырская тематика и ссылки на монастырь не меняют указанного оператора сервиса.'
        ],'Impressum',[
            'Angaben gemäß § 5 DDG. Betreiber der Kalenderwerkstatt und Ansprechpartner für Druckanfragen:',$contact,
            'Diese Angaben gelten für kalender.georg-kloster.de und kalender.georg-kloster.ru. Der thematische Bezug zum Kloster und Links auf dessen Website ändern den hier genannten Betreiber nicht.'
        ]),
        $make('c8f7905a-d26a-4bc8-926b-2ce80d200002','datenschutz',20,'Datenschutz — конфиденциальность',[
            'Ответственный за обработку персональных данных:',$contact,
            'Сервис предназначен для создания и хранения календарей. При регистрации обрабатываются e-mail, подтверждение адреса, хеш пароля и сведения о сессии. Пароль не хранится открытым текстом. Необходимые cookies обеспечивают вход; сессия аккаунта действует до 30 дней. Настройки интерфейса и рабочие копии могут храниться в браузере.',
            'На сервере сохраняются ваши календари, фотографии и другие загруженные материалы, PDF, версии и корзина. Администратор имеет доступ для обслуживания и поддержки. Удаление календаря в корзину не означает окончательное удаление всех копий. Для полного удаления данных или аккаунта обращайтесь по указанному e-mail. Срок хранения определяется необходимостью предоставления сервиса, обработки запроса и применимыми обязанностями хранения; резервные копии и технические журналы учитываются отдельно.',
            'Основания: предоставление запрошенного сервиса и обработка запросов о печати — ст. 6(1)(b) GDPR; безопасность, технические журналы и предотвращение злоупотреблений — ст. 6(1)(f). Сервер размещён у STRATO GmbH в Германии. При соединении могут обрабатываться IP-адрес, время, запрошенный ресурс и технические сведения браузера.',
            'Рассылка включается только по отдельному добровольному согласию (ст. 6(1)(a) GDPR). Хранятся адрес, состояние подписки и сведения о согласии и отправке. Отписаться можно в письме или настройках аккаунта. Отзыв согласия не влияет на законность предшествующей обработки.',
            'Кнопка заказа печати показывает контакты и не передаёт оплату в Stripe. По телефону или e-mail обрабатываются сообщённые вами сведения для обсуждения заказа. ИИ-помощник доступен администратору: выбранный им текст отправляется OpenAI только по отдельному действию. Автоматическая отправка пользовательских календарей и фотографий этому помощнику не предусмотрена.',
            'По предусмотренным законом основаниям вы можете запросить доступ, исправление, удаление, ограничение обработки и переносимость данных, возразить против обработки и отозвать согласие. Вы вправе подать жалобу в надзорный орган, в частности LDA Brandenburg, Stahnsdorfer Damm 77, 14532 Kleinmachnow, Poststelle@LDA.Brandenburg.de.'
        ],'Datenschutzerklärung',[
            'Verantwortlicher für die Verarbeitung personenbezogener Daten:',$contact,
            'Die Kalenderwerkstatt dient der Erstellung und Speicherung von Kalendern. Bei der Registrierung verarbeiten wir E-Mail-Adresse, Adressbestätigung, Passwort-Hash und Sitzungsinformationen. Passwörter werden nicht im Klartext gespeichert. Erforderliche Cookies ermöglichen die Anmeldung; eine Kontositzung gilt bis zu 30 Tage. Oberflächeneinstellungen und Arbeitskopien können im Browser gespeichert werden.',
            'Auf dem Server speichern wir Kalender, Fotos und weitere hochgeladene Materialien, PDF-Dateien, Versionen und Papierkorbinhalte. Administratoren können für Betrieb und Unterstützung darauf zugreifen. Das Verschieben in den Papierkorb löscht nicht sofort sämtliche Kopien. Für eine vollständige Löschung von Daten oder Konto kontaktieren Sie uns per E-Mail. Die Speicherdauer richtet sich nach der Erforderlichkeit für den Dienst, die Bearbeitung von Anfragen und gesetzlichen Aufbewahrungspflichten; Sicherungskopien und technische Protokolle sind gesondert zu berücksichtigen.',
            'Rechtsgrundlagen: Bereitstellung des angefragten Dienstes und Bearbeitung von Druckanfragen — Art. 6 Abs. 1 lit. b DSGVO; Sicherheit, technische Protokolle und Missbrauchsprävention — Art. 6 Abs. 1 lit. f DSGVO. Das Hosting erfolgt bei STRATO GmbH in Deutschland. Beim Verbindungsaufbau können IP-Adresse, Zeitpunkt, angefragte Ressource und technische Browserinformationen verarbeitet werden.',
            'Newsletter werden nur nach gesonderter freiwilliger Einwilligung versendet (Art. 6 Abs. 1 lit. a DSGVO). Wir speichern Adresse, Abonnementstatus sowie Einwilligungs- und Versandinformationen. Die Abmeldung ist im Newsletter oder in den Kontoeinstellungen möglich. Ein Widerruf berührt nicht die Rechtmäßigkeit der bisherigen Verarbeitung.',
            'Die Druck-Schaltfläche zeigt Kontaktdaten und übermittelt keine Zahlung an Stripe. Bei Kontakt per Telefon oder E-Mail verarbeiten wir die von Ihnen übermittelten Angaben zur Abstimmung eines Auftrags. Der KI-Assistent steht Administratoren zur Verfügung: Von ihnen ausgewählter Text wird erst durch eine ausdrückliche Aktion an OpenAI übertragen. Eine automatische Übermittlung von Benutzerkalendern oder Fotos an diesen Assistenten ist nicht vorgesehen.',
            'Nach den gesetzlichen Voraussetzungen bestehen Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch und Widerruf einer Einwilligung. Sie können sich bei einer Datenschutzaufsichtsbehörde beschweren, insbesondere bei der LDA Brandenburg, Stahnsdorfer Damm 77, 14532 Kleinmachnow, Poststelle@LDA.Brandenburg.de.'
        ]),
        $make('c8f7905a-d26a-4bc8-926b-2ce80d200003','agb',30,'AGB — условия пользования',[
            'Оператор: Volodymyr Atapin, ATAPIN.DE. Контактные сведения приведены в Impressum. Эти условия относятся к календарной мастерской на обоих доменах.',
            'Мастерская позволяет создавать календари, загружать материалы и сохранять результаты. Берегите данные входа и используйте только материалы, на использование которых у вас есть необходимые права, включая права изображённых людей. Загрузка не передаёт оператору права собственности на ваши материалы; она позволяет обрабатывать их для предоставления сервиса.',
            'Перед печатью проверяйте даты, тексты, изображения, формат, поля и готовый PDF. Сохраняйте важные результаты также на компьютер. О нарушениях прав или технических неполадках сообщайте оператору; он рассматривает обращения и может ограничить неправомерное использование.',
            '«Заказать печать» открывает только контактные данные. Нажатие не создаёт платный заказ. Тираж, цена, материалы, доставка, сроки и условия оплаты согласуются отдельно. Договор печати заключается после принятия индивидуального предложения или подтверждения заказа. Обязательная информация для конкретного договора предоставляется до его заключения.',
            'Применяются предусмотренные законом права в отношении недостатков и ответственности. Эти условия не ограничивают обязательные права потребителей. Для расторжения отношений и удаления аккаунта свяжитесь с оператором.'
        ],'AGB / Nutzungsbedingungen',[
            'Anbieter ist Volodymyr Atapin, handelnd unter ATAPIN.DE. Kontaktdaten stehen im Impressum. Diese Bedingungen beziehen sich auf die Kalenderwerkstatt auf beiden Domains.',
            'Die Werkstatt ermöglicht die Erstellung von Kalendern, das Hochladen von Materialien und das Speichern von Ergebnissen. Schützen Sie Ihre Zugangsdaten. Verwenden Sie nur Materialien, für deren Nutzung Sie die notwendigen Rechte besitzen, einschließlich der Rechte abgebildeter Personen. Durch das Hochladen geht kein Eigentum an Ihren Materialien auf den Betreiber über; die Verarbeitung erfolgt zur Bereitstellung des Dienstes.',
            'Prüfen Sie vor dem Druck Daten, Texte, Bilder, Format, Ränder und die fertige PDF-Datei. Speichern Sie wichtige Ergebnisse zusätzlich auf Ihrem Computer. Melden Sie Rechtsverletzungen oder technische Probleme dem Betreiber; dieser prüft Hinweise und kann rechtswidrige Nutzungen beschränken.',
            '„Kalenderdruck bestellen“ öffnet ausschließlich Kontaktdaten. Ein Klick löst keine kostenpflichtige Bestellung aus. Auflage, Preis, Materialien, Lieferung, Termine und Zahlungsbedingungen werden individuell vereinbart. Ein Druckvertrag kommt durch Annahme eines individuellen Angebots oder Auftragsbestätigung zustande. Die für den konkreten Vertrag erforderlichen Pflichtinformationen werden vor Vertragsschluss bereitgestellt.',
            'Es gelten die gesetzlichen Mängel- und Haftungsregelungen. Zwingende Verbraucherrechte werden durch diese Bedingungen nicht beschränkt. Zur Beendigung der Nutzung und Löschung eines Kontos kontaktieren Sie den Betreiber.'
        ])
    ];
}
