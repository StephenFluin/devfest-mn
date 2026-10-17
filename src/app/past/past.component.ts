import { Component } from '@angular/core';

@Component({
    selector: 'app-past',
    imports: [],
    template: `
        <section>
            <h2>Past DevFestMN Events</h2>
            <div style="max-width:300px;text-align:left;margin:0px auto;font-size:1.4rem;">
                <ul>
                    <li><a href="https://2025.devfest.mn">DevFestMN 2025</a></li>
                    <li><a href="https://2024.devfest.mn">DevFestMN 2024</a></li>
                    <li><a href="https://2023.devfest.mn">DevFestMN 2023</a></li>
                    <li><a href="https://past.devfest.mn/2019ai/speakers">DevFestMN 2019: Focus on ML + AI</a></li>
                    <li><a href="https://past.devfest.mn/2019/speakers">DevFestMN 2019</a></li>
                    <li><a href="https://past.devfest.mn/2018/speakers">DevFestMN 2018</a></li>
                    <li><a href="https://past.devfest.mn/2017/speakers">DevFestMN 2017</a></li>
                    <li><a href="https://past.devfest.mn/a/2016/">DevFestMN 2016</a></li>
                </ul>
            </div>
        </section>
    `,
})
export class PastComponent {}
